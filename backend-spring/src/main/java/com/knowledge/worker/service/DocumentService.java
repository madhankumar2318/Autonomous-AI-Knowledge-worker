package com.knowledge.worker.service;

import com.knowledge.worker.entity.Upload;
import com.knowledge.worker.repository.UploadRepository;
import com.knowledge.worker.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentService {

    private final UploadRepository uploadRepository;
    private final UserRepository userRepository;

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    private final Map<String, String> documentCache = new ConcurrentHashMap<>();
    private final Map<String, Long> documentCacheTime = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L; // 10 minutes

    /**
     * Configure Apache POI global zip-bomb defense at startup.
     * - minInflateRatio: compressed/uncompressed ratio threshold (0.01 = 100:1 max inflation)
     * - maxEntrySize:    max bytes for any single ZIP entry (50 MB)
     * - maxTextSize:     max extracted text bytes (20 MB)
     */
    @PostConstruct
    public void configureParsingSecurity() {
        ZipSecureFile.setMinInflateRatio(0.01);
        ZipSecureFile.setMaxEntrySize(50 * 1024 * 1024L);   // 50 MB per entry
        ZipSecureFile.setMaxTextSize(20 * 1024 * 1024L);    // 20 MB text
        log.info("DocumentService: Apache POI zip-bomb defenses configured.");
    }

    /**
     * Retrieve uploads strictly authorized for the given user.
     */
    public List<Upload> getUploadsForUser(String username) {
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username) || "guest".equalsIgnoreCase(username)) {
            return Collections.emptyList();
        }
        if ("admin".equalsIgnoreCase(username)) {
            return uploadRepository.findAllByOrderByUploadedAtDesc();
        }
        return userRepository.findByUsername(username)
                .map(u -> uploadRepository.findByUserIdOrUserIdIsNullOrderByUploadedAtDesc(u.getId()))
                .orElse(Collections.emptyList());
    }

    public List<Upload> getAllUploads() {
        return uploadRepository.findAll();
    }

    public List<Upload> getAllUploadsForUser(String username) {
        return getUploadsForUser(username);
    }

    /**
     * Validate whether a user is authorized to access a document.
     */
    public boolean isAuthorized(String filename, String username) {
        if (filename == null || filename.isBlank()) return false;
        if (username != null && "admin".equalsIgnoreCase(username)) return true;
        Optional<Upload> uploadOpt = uploadRepository.findByFilename(filename);
        if (uploadOpt.isEmpty()) return false;
        Upload upload = uploadOpt.get();
        if (upload.getUserId() == null) return true; // Public workspace document
        if (username == null || username.isBlank() || "guest".equalsIgnoreCase(username)) return false;
        return userRepository.findByUsername(username)
                .map(u -> u.getId().equals(upload.getUserId()))
                .orElse(false);
    }

    /**
     * Extract document text with authorization check.
     */
    public String extractDocumentTextForUser(String filename, String username) {
        if (filename == null || filename.isBlank()) return "";
        if (!isAuthorized(filename, username)) {
            log.warn("[SECURITY-RAG] Blocked unauthorized document access: user '{}' attempted to read '{}'", username, filename);
            return "Access denied: Document '" + filename + "' is not accessible in your workspace.";
        }
        return extractDocumentText(filename);
    }

    /**
     * Find matching upload scoped strictly to the requesting user's workspace.
     */
    public Optional<Upload> findMatchingUpload(String queryOrFilename, String username) {
        if (queryOrFilename == null || queryOrFilename.isBlank()) {
            return Optional.empty();
        }
        List<Upload> allowed = getUploadsForUser(username);
        if (allowed.isEmpty()) {
            return Optional.empty();
        }
        return matchFromList(queryOrFilename, allowed);
    }

    public Optional<Upload> findMatchingUpload(String queryOrFilename) {
        return findMatchingUpload(queryOrFilename, "admin");
    }

    private Optional<Upload> matchFromList(String queryOrFilename, List<Upload> all) {
        String clean = queryOrFilename.trim().toLowerCase();
        String normalizedQuery = clean.replaceAll("[^a-z0-9]", "");

        // 1. Exact match
        for (Upload u : all) {
            if (u.getFilename() != null && u.getFilename().equalsIgnoreCase(clean)) {
                return Optional.of(u);
            }
        }

        // 2. Normalized alphanumeric match
        for (Upload u : all) {
            if (u.getFilename() == null) continue;
            String normU = u.getFilename().toLowerCase().replaceAll("[^a-z0-9]", "");
            if (normU.equals(normalizedQuery) || normalizedQuery.contains(normU) || normU.contains(normalizedQuery)) {
                return Optional.of(u);
            }
            int dotIdx = normU.lastIndexOf('.');
            String withoutExt = (dotIdx > 0) ? normU.substring(0, dotIdx) : normU;
            if (withoutExt.length() >= 4 && (normalizedQuery.contains(withoutExt) || withoutExt.contains(normalizedQuery))) {
                return Optional.of(u);
            }
        }

        // 3. Keyword / token match
        for (Upload u : all) {
            if (u.getFilename() == null) continue;
            String uName = u.getFilename().toLowerCase();
            String[] tokens = clean.split("[\\s_\\-\\(\\)\\[\\]\\.]+");
            for (String tok : tokens) {
                if (tok.length() >= 4 && uName.contains(tok)) {
                    return Optional.of(u);
                }
            }
        }

        // 4. Resume / CV keywords
        if (clean.contains("resume") || clean.contains("cv")) {
            for (Upload u : all) {
                if (u.getFilename() == null) continue;
                String uName = u.getFilename().toLowerCase();
                if (uName.contains("resume") || uName.contains("cv")) {
                    return Optional.of(u);
                }
            }
        }

        // 5. Excel / spreadsheet keywords
        if (clean.contains("excel") || clean.contains("sheet") || clean.contains("spreadsheet") ||
            clean.contains("xlsx") || clean.contains("xls") || clean.contains("csv")) {
            for (Upload u : all) {
                if (u.getFilename() == null) continue;
                String uName = u.getFilename().toLowerCase();
                if (uName.endsWith(".xlsx") || uName.endsWith(".xls") || uName.endsWith(".csv")) {
                    return Optional.of(u);
                }
            }
        }

        // 6. Generic queries about uploaded document or data
        if (clean.contains("file") || clean.contains("document") || clean.contains("upload") ||
            clean.contains("workspace") || clean.contains("data") || clean.contains("table") ||
            clean.contains("summarize") || clean.contains("what is in") || clean.contains("analyze")) {
            if (all.size() == 1) {
                return Optional.of(all.get(0));
            }
            return Optional.of(all.get(all.size() - 1));
        }

        return Optional.empty();
    }

    /**
     * Extract full text from an uploaded document (PDF, CSV, JSON, TXT, MD).
     */
    public String extractDocumentText(String filename) {
        if (filename == null || filename.isBlank()) {
            return "";
        }

        String decoded = filename;
        try {
            decoded = URLDecoder.decode(filename, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        // Check cache first
        Long cachedAt = documentCacheTime.get(decoded);
        if (cachedAt != null && (System.currentTimeMillis() - cachedAt) < CACHE_TTL_MS) {
            String cached = documentCache.get(decoded);
            if (cached != null) return cached;
        }

        // Try to get from persistent database first
        Optional<Upload> uploadOpt = uploadRepository.findByFilename(decoded);
        if (uploadOpt.isEmpty() && !decoded.equals(filename)) {
            uploadOpt = uploadRepository.findByFilename(filename);
        }
        if (uploadOpt.isPresent() && uploadOpt.get().getExtractedContent() != null && !uploadOpt.get().getExtractedContent().isBlank()) {
            String dbContent = uploadOpt.get().getExtractedContent();
            documentCache.put(decoded, dbContent);
            documentCacheTime.put(decoded, System.currentTimeMillis());
            return dbContent;
        }

        // Locate file on disk with path traversal safety check
        String sanitizedName = Paths.get(decoded).getFileName().toString();
        Path basePath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path targetPath = basePath.resolve(sanitizedName).normalize();
        if (!targetPath.startsWith(basePath)) {
            log.warn("Path traversal attempted in extractDocumentText: {}", filename);
            return "Error: Invalid filename";
        }

        File file = targetPath.toFile();
        if (!file.exists()) {
            // Also check raw filename if different
            if (!decoded.equals(filename)) {
                String rawSanitized = Paths.get(filename).getFileName().toString();
                Path rawTarget = basePath.resolve(rawSanitized).normalize();
                if (rawTarget.startsWith(basePath) && rawTarget.toFile().exists()) {
                    file = rawTarget.toFile();
                }
            }
        }

        if (!file.exists()) {
            return "File '" + decoded + "' was not found on server storage.";
        }

        String lower = file.getName().toLowerCase();
        String result;

        try {
            if (lower.endsWith(".pdf")) {
                result = parsePdf(file);
            } else if (lower.endsWith(".docx")) {
                result = parseDocx(file);
            } else if (lower.endsWith(".doc")) {
                result = "Legacy Word document (.doc) detected. Please re-save as .docx for full parsing support.";
            } else if (lower.endsWith(".xlsx")) {
                result = parseXlsx(file);
            } else if (lower.endsWith(".xls")) {
                result = parseXls(file);
            } else if (lower.endsWith(".csv")) {
                result = parseCsv(file);
            } else if (lower.endsWith(".json")) {
                result = parseJson(file);
            } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log") || lower.endsWith(".env")) {
                result = parsePlainText(file);
            } else {
                result = "Unsupported document format: " + file.getName();
            }

            // Update database and cache
            if (uploadOpt.isPresent() && result != null && !result.isBlank() && !result.startsWith("Error")) {
                Upload u = uploadOpt.get();
                u.setExtractedContent(result);
                uploadRepository.save(u);
            }

            documentCache.put(decoded, result != null ? result : "");
            documentCacheTime.put(decoded, System.currentTimeMillis());
            return result != null ? result : "";

        } catch (Exception e) {
            log.error("Failed to parse document {}: {}", file.getName(), e.getMessage());
            return "Error parsing document: " + e.getMessage();
        }
    }

    private String parsePdf(File file) throws IOException {
        try (PDDocument doc = PDDocument.load(file, MemoryUsageSetting.setupMainMemoryOnly(50 * 1024 * 1024L))) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String text = stripper.getText(doc);
            return text != null && !text.isBlank() ? text.trim() : "PDF document contains no readable text (it may be scanned/image-only).";
        }
    }

    private String parseDocx(File file) throws IOException {
        try (InputStream is = new FileInputStream(file);
             XWPFDocument doc = new XWPFDocument(is)) {
            StringBuilder sb = new StringBuilder();
            for (XWPFParagraph p : doc.getParagraphs()) {
                String t = p.getText();
                if (t != null && !t.isBlank()) {
                    sb.append(t).append("\n");
                }
            }
            for (XWPFTable tbl : doc.getTables()) {
                for (XWPFTableRow row : tbl.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell c : row.getTableCells()) {
                        cells.add(c.getText().trim());
                    }
                    sb.append("| ").append(String.join(" | ", cells)).append(" |\n");
                }
                sb.append("\n");
            }
            return sb.length() > 0 ? sb.toString().trim() : "DOCX file is empty.";
        }
    }

    private String parseXlsx(File file) throws IOException {
        try (InputStream is = new FileInputStream(file);
             Workbook workbook = WorkbookFactory.create(is)) {
            return extractWorkbookText(workbook, file.getName());
        }
    }

    private String parseXls(File file) throws IOException {
        try (InputStream is = new FileInputStream(file);
             Workbook workbook = WorkbookFactory.create(is)) {
            return extractWorkbookText(workbook, file.getName());
        }
    }

    private String extractWorkbookText(Workbook workbook, String filename) {
        StringBuilder sb = new StringBuilder();
        DataFormatter formatter = new DataFormatter();
        int totalSheets = workbook.getNumberOfSheets();

        sb.append("=== Spreadsheet: ").append(filename).append(" (").append(totalSheets).append(" sheets) ===\n\n");

        for (int s = 0; s < Math.min(totalSheets, 10); s++) {
            Sheet sheet = workbook.getSheetAt(s);
            sb.append("--- Sheet: ").append(sheet.getSheetName()).append(" ---\n");

            int firstRow = sheet.getFirstRowNum();
            int lastRow = Math.min(sheet.getLastRowNum(), firstRow + 300); // max 300 rows per sheet

            for (int r = firstRow; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                List<String> cellValues = new ArrayList<>();
                boolean hasContent = false;
                short lastCell = row.getLastCellNum();

                for (int c = 0; c < Math.min((int) lastCell, 30); c++) {
                    Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    String val = cell == null ? "" : formatter.formatCellValue(cell).trim();
                    if (!val.isEmpty()) hasContent = true;
                    cellValues.add(val);
                }

                if (hasContent) {
                    sb.append(String.join(" | ", cellValues)).append("\n");
                }
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private String parseCsv(File file) throws IOException {
        List<String> lines = Files.readAllLines(file.toPath(), StandardCharsets.UTF_8);
        if (lines.isEmpty()) return "CSV file is empty.";

        StringBuilder sb = new StringBuilder();
        int limit = Math.min(lines.size(), 500);
        for (int i = 0; i < limit; i++) {
            sb.append(lines.get(i)).append("\n");
        }
        if (lines.size() > 500) {
            sb.append(String.format("\n... [Showing 500 of %d rows total]", lines.size()));
        }
        return sb.toString().trim();
    }

    private String parseJson(File file) throws IOException {
        String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
        return content != null && !content.isBlank() ? content.trim() : "JSON file is empty.";
    }

    private String parsePlainText(File file) throws IOException {
        String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
        return content != null && !content.isBlank() ? content.trim() : "File is empty.";
    }

    public Map<String, Object> parseSpreadsheetData(String filename, String sheetNameParam) {
        String sanitizedName = Paths.get(filename).getFileName().toString();
        File file = Paths.get(uploadDir, sanitizedName).toFile();
        String lower = filename.toLowerCase();

        if (file.exists() && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
            try (InputStream is = new FileInputStream(file);
                 Workbook workbook = WorkbookFactory.create(is)) {

                List<String> sheetNames = new ArrayList<>();
                for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                    sheetNames.add(workbook.getSheetName(i));
                }

                String activeSheetName = (sheetNameParam != null && !sheetNameParam.isBlank() && sheetNames.contains(sheetNameParam))
                        ? sheetNameParam : (sheetNames.isEmpty() ? "Sheet1" : sheetNames.get(0));

                Sheet sheet = workbook.getSheet(activeSheetName);
                DataFormatter formatter = new DataFormatter();
                List<String> headers = new ArrayList<>();
                List<List<String>> rows = new ArrayList<>();

                if (sheet != null) {
                    int firstRow = sheet.getFirstRowNum();
                    int lastRow = Math.min(sheet.getLastRowNum(), firstRow + 500);

                    boolean foundHeader = false;
                    int maxCols = 0;

                    for (int r = firstRow; r <= lastRow; r++) {
                        Row row = sheet.getRow(r);
                        if (row == null) continue;

                        short lastCell = row.getLastCellNum();
                        if (lastCell <= 0) continue;

                        List<String> cellValues = new ArrayList<>();
                        boolean hasContent = false;
                        for (int c = 0; c < Math.min((int) lastCell, 50); c++) {
                            Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                            String val = cell == null ? "" : formatter.formatCellValue(cell).trim();
                            if (!val.isEmpty()) hasContent = true;
                            cellValues.add(val);
                        }

                        if (!hasContent) continue;

                        if (!foundHeader) {
                            headers = cellValues;
                            maxCols = headers.size();
                            foundHeader = true;
                        } else {
                            while (cellValues.size() < maxCols) cellValues.add("");
                            rows.add(cellValues);
                        }
                    }
                }

                return Map.of(
                        "filename", filename,
                        "sheet_names", sheetNames,
                        "active_sheet", activeSheetName,
                        "headers", headers,
                        "rows", rows
                );
            } catch (Exception e) {
                log.error("Failed to parse spreadsheet data for {}: {}", filename, e.getMessage());
            }
        } else if (file.exists() && lower.endsWith(".csv")) {
            try {
                List<String> lines = Files.readAllLines(file.toPath(), StandardCharsets.UTF_8);
                List<String> headers = new ArrayList<>();
                List<List<String>> rows = new ArrayList<>();
                if (!lines.isEmpty()) {
                    String[] h = lines.get(0).split(",");
                    for (String col : h) headers.add(col.trim().replace("\"", ""));
                    for (int i = 1; i < Math.min(lines.size(), 500); i++) {
                        String line = lines.get(i).trim();
                        if (!line.isEmpty()) {
                            String[] parts = line.split(",");
                            List<String> row = new ArrayList<>();
                            for (String p : parts) row.add(p.trim().replace("\"", ""));
                            while (row.size() < headers.size()) row.add("");
                            rows.add(row);
                        }
                    }
                }
                return Map.of(
                        "filename", filename,
                        "sheet_names", List.of("Default"),
                        "active_sheet", "Default",
                        "headers", headers,
                        "rows", rows
                );
            } catch (Exception e) {
                log.error("Failed to parse CSV table for {}: {}", filename, e.getMessage());
            }
        }

        return Map.of(
                "filename", filename,
                "sheet_names", List.of("Sheet1"),
                "active_sheet", "Sheet1",
                "headers", List.of("Item", "Value"),
                "rows", List.of()
        );
    }

    /**
     * Invalidate cached text for a deleted or updated file.
     */
    public void invalidateCache(String filename) {
        if (filename != null) {
            documentCache.remove(filename);
            documentCacheTime.remove(filename);
        }
    }

    /**
     * Search across user's workspace uploaded files for text passages relevant to a query.
     */
    public String searchKnowledge(String query, String activeFilename, String username) {
        if (query == null || query.isBlank()) {
            return "No query provided.";
        }

        List<Upload> allowed = getUploadsForUser(username);
        if (allowed.isEmpty()) {
            return "No uploaded documents found in your workspace knowledge base.";
        }

        List<Upload> targets = new ArrayList<>();
        if (activeFilename != null && !activeFilename.isBlank()) {
            allowed.stream()
                    .filter(u -> u.getFilename() != null && u.getFilename().equalsIgnoreCase(activeFilename.trim()))
                    .findFirst()
                    .ifPresent(targets::add);
        }

        if (targets.isEmpty()) {
            matchFromList(query, allowed).ifPresent(targets::add);
        }

        if (targets.isEmpty()) {
            targets = allowed;
        }

        StringBuilder results = new StringBuilder();
        String[] keywords = query.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");

        for (Upload u : targets) {
            String fullText = extractDocumentTextForUser(u.getFilename(), username);
            if (fullText.startsWith("File '") || fullText.startsWith("Error parsing") || fullText.startsWith("Access denied")) {
                continue;
            }

            // Split into paragraph chunks (~400-800 characters)
            String[] paragraphs = fullText.split("\n\n+");
            List<ScoredChunk> scored = new ArrayList<>();

            for (int i = 0; i < paragraphs.length; i++) {
                String p = paragraphs[i].trim();
                if (p.length() < 20) continue;

                int score = 0;
                String pLower = p.toLowerCase();
                for (String kw : keywords) {
                    if (kw.length() >= 3 && pLower.contains(kw)) {
                        score += 5;
                    }
                }

                if (score > 0 || paragraphs.length <= 4) {
                    scored.add(new ScoredChunk(u.getFilename(), i + 1, p, score));
                }
            }

            scored.sort((a, b) -> Integer.compare(b.score, a.score));

            int take = Math.min(scored.size(), 4);
            for (int i = 0; i < take; i++) {
                ScoredChunk c = scored.get(i);
                results.append(String.format("--- [Source: %s, Passage #%d] ---\n%s\n\n",
                        c.filename, c.passageIndex, c.text));
            }
        }

        if (results.length() == 0) {
            Upload first = targets.get(0);
            String text = extractDocumentTextForUser(first.getFilename(), username);
            String excerpt = text.length() > 1500 ? text.substring(0, 1500) + "..." : text;
            return String.format("--- [Source: %s, Full Overview] ---\n%s\n", first.getFilename(), excerpt);
        }

        return results.toString();
    }

    public String searchKnowledge(String query, String activeFilename) {
        return searchKnowledge(query, activeFilename, "guest");
    }

    private static class ScoredChunk {
        String filename;
        int passageIndex;
        String text;
        int score;

        ScoredChunk(String filename, int passageIndex, String text, int score) {
            this.filename = filename;
            this.passageIndex = passageIndex;
            this.text = text;
            this.score = score;
        }
    }
}
