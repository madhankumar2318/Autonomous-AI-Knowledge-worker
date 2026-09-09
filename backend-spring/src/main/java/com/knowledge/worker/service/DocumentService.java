package com.knowledge.worker.service;

import com.knowledge.worker.entity.Upload;
import com.knowledge.worker.repository.UploadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
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

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    private final Map<String, String> documentCache = new ConcurrentHashMap<>();
    private final Map<String, Long> documentCacheTime = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L; // 10 minutes

    /**
     * Return all uploaded documents in the workspace.
     */
    public List<Upload> getAllUploads() {
        return uploadRepository.findAll();
    }

    /**
     * Find an uploaded file by exact, fuzzy, or semantic query matching.
     */
    public Optional<Upload> findMatchingUpload(String queryOrFilename) {
        if (queryOrFilename == null || queryOrFilename.isBlank()) {
            return Optional.empty();
        }

        List<Upload> all = uploadRepository.findAll();
        if (all.isEmpty()) {
            return Optional.empty();
        }

        String clean = queryOrFilename.trim().toLowerCase();
        String normalizedQuery = clean.replaceAll("[^a-z0-9]", "");

        // 1. Exact match
        for (Upload u : all) {
            if (u.getFilename() != null && u.getFilename().equalsIgnoreCase(clean)) {
                return Optional.of(u);
            }
        }

        // 2. Normalized alphanumeric match (e.g. "activity4jan10xlsx" vs "whatisintheactivity4jan10xlsx")
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

        // 3. Keyword / token match (e.g. "activity", "jan")
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

        // 6. Generic queries about uploaded document or data ("file", "document", "upload", "data", "table", "activity")
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

        long now = System.currentTimeMillis();
        if (documentCache.containsKey(filename) && (now - documentCacheTime.getOrDefault(filename, 0L) < CACHE_TTL_MS)) {
            return documentCache.get(filename);
        }

        Path target = Paths.get(uploadDir, filename);
        File file = target.toFile();
        if (!file.exists()) {
            Optional<Upload> up = uploadRepository.findByFilename(filename);
            if (up.isEmpty()) {
                String lowerName = filename.toLowerCase();
                up = uploadRepository.findAll().stream()
                        .filter(u -> u.getFilename() != null && u.getFilename().equalsIgnoreCase(lowerName))
                        .findFirst();
            }
            if (up.isPresent() && up.get().getFilepath() != null) {
                file = new File(up.get().getFilepath());
            }
        }
        if (!file.exists()) {
            try {
                String decoded = URLDecoder.decode(filename, StandardCharsets.UTF_8);
                File decodedFile = Paths.get(uploadDir, decoded).toFile();
                if (decodedFile.exists()) {
                    file = decodedFile;
                }
            } catch (Exception ignored) {}
        }
        if (!file.exists()) {
            File dir = new File(uploadDir);
            if (dir.exists() && dir.isDirectory()) {
                File[] list = dir.listFiles();
                if (list != null) {
                    for (File f : list) {
                        if (f.getName().equalsIgnoreCase(filename)) {
                            file = f;
                            break;
                        }
                    }
                }
            }
        }

        if (!file.exists() || !file.canRead()) {
            log.warn("File {} not found or unreadable on disk at {}", filename, target.toAbsolutePath());
            return "File '" + filename + "' was not found on server storage.";
        }

        String lower = filename.toLowerCase();
        String extracted;

        try {
            if (lower.endsWith(".pdf")) {
                try (PDDocument document = PDDocument.load(file)) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    stripper.setSortByPosition(true);
                    extracted = stripper.getText(document);
                }
            } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
                extracted = extractExcelText(file);
            } else if (lower.endsWith(".docx")) {
                extracted = extractWordText(file);
            } else {
                extracted = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            }

            if (extracted != null && !extracted.isBlank()) {
                documentCache.put(filename, extracted);
                documentCacheTime.put(filename, now);
                return extracted;
            }
        } catch (Exception e) {
            log.error("Failed to extract text from {}: {}", filename, e.getMessage());
            return "Error parsing document '" + filename + "': " + e.getMessage();
        }

        return "No text content could be extracted from " + filename;
    }

    private String extractExcelText(File file) {
        StringBuilder sb = new StringBuilder();
        DataFormatter formatter = new DataFormatter();
        try (InputStream is = new FileInputStream(file);
             Workbook workbook = WorkbookFactory.create(is)) {

            int numberOfSheets = workbook.getNumberOfSheets();
            for (int s = 0; s < numberOfSheets; s++) {
                Sheet sheet = workbook.getSheetAt(s);
                String sheetName = sheet.getSheetName();
                sb.append("\n### Sheet: ").append(sheetName).append("\n\n");

                int firstRow = sheet.getFirstRowNum();
                int lastRow = sheet.getLastRowNum();
                if (lastRow < firstRow) {
                    sb.append("*(Empty sheet)*\n\n");
                    continue;
                }

                int maxRows = Math.min(lastRow + 1, firstRow + 300);
                boolean headerWritten = false;
                int maxCols = 0;

                for (int r = firstRow; r < maxRows; r++) {
                    Row row = sheet.getRow(r);
                    if (row != null && row.getLastCellNum() > maxCols) {
                        maxCols = Math.min((int) row.getLastCellNum(), 40);
                    }
                }
                if (maxCols <= 0) maxCols = 1;

                for (int r = firstRow; r < maxRows; r++) {
                    Row row = sheet.getRow(r);
                    if (row == null) continue;

                    List<String> cellValues = new ArrayList<>();
                    boolean hasContent = false;

                    for (int c = 0; c < maxCols; c++) {
                        Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        if (cell == null) {
                            cellValues.add("");
                        } else {
                            String val = formatter.formatCellValue(cell).trim();
                            val = val.replace("\n", " ").replace("|", "\\|");
                            if (!val.isEmpty()) hasContent = true;
                            cellValues.add(val);
                        }
                    }

                    if (hasContent) {
                        if (!headerWritten) {
                            sb.append("| ").append(String.join(" | ", cellValues)).append(" |\n");
                            sb.append("|").append(" --- |".repeat(cellValues.size())).append("\n");
                            headerWritten = true;
                        } else {
                            sb.append("| ").append(String.join(" | ", cellValues)).append(" |\n");
                        }
                    }
                }

                if (lastRow + 1 > maxRows) {
                    sb.append("\n*... [").append(lastRow + 1 - maxRows).append(" more rows in sheet '").append(sheetName).append("']*\n\n");
                } else {
                    sb.append("\n\n");
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Excel file {}: {}", file.getName(), e.getMessage(), e);
            return "Error parsing Excel document '" + file.getName() + "': " + e.getMessage();
        }
        return sb.toString().trim();
    }

    private String extractWordText(File file) {
        StringBuilder sb = new StringBuilder();
        try (InputStream is = new FileInputStream(file);
             XWPFDocument doc = new XWPFDocument(is)) {

            for (XWPFParagraph p : doc.getParagraphs()) {
                String text = p.getText();
                if (text != null && !text.isBlank()) {
                    sb.append(text).append("\n");
                }
            }

            for (XWPFTable table : doc.getTables()) {
                sb.append("\n");
                for (XWPFTableRow row : table.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell cell : row.getTableCells()) {
                        cells.add(cell.getText().trim());
                    }
                    sb.append("| ").append(String.join(" | ", cells)).append(" |\n");
                }
                sb.append("\n");
            }
        } catch (Exception e) {
            log.error("Failed to parse Word document {}: {}", file.getName(), e.getMessage(), e);
            return "Error parsing Word document '" + file.getName() + "': " + e.getMessage();
        }
        return sb.toString().trim();
    }

    public Map<String, Object> parseSpreadsheetData(String filename, String requestedSheet) {
        Path target = Paths.get(uploadDir, filename);
        File file = target.toFile();
        if (!file.exists()) {
            Optional<Upload> up = uploadRepository.findByFilename(filename);
            if (up.isPresent() && up.get().getFilepath() != null) {
                file = new File(up.get().getFilepath());
            }
        }
        if (!file.exists()) {
            File dir = new File(uploadDir);
            if (dir.exists() && dir.isDirectory()) {
                File[] list = dir.listFiles();
                if (list != null) {
                    for (File f : list) {
                        if (f.getName().equalsIgnoreCase(filename)) {
                            file = f;
                            break;
                        }
                    }
                }
            }
        }

        String lower = filename.toLowerCase();
        if (file.exists() && (lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
            DataFormatter formatter = new DataFormatter();
            try (InputStream is = new FileInputStream(file);
                 Workbook workbook = WorkbookFactory.create(is)) {

                List<String> sheetNames = new ArrayList<>();
                for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                    sheetNames.add(workbook.getSheetAt(s).getSheetName());
                }

                String activeSheetName = sheetNames.isEmpty() ? "Sheet1" : sheetNames.get(0);
                if (requestedSheet != null && sheetNames.contains(requestedSheet)) {
                    activeSheetName = requestedSheet;
                }

                Sheet sheet = workbook.getSheet(activeSheetName);
                if (sheet == null && !sheetNames.isEmpty()) {
                    sheet = workbook.getSheetAt(0);
                    activeSheetName = sheetNames.get(0);
                }

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
     * Search across workspace uploaded files for text passages relevant to a query.
     */
    public String searchKnowledge(String query, String activeFilename) {
        if (query == null || query.isBlank()) {
            return "No query provided.";
        }

        List<Upload> targets = new ArrayList<>();
        if (activeFilename != null && !activeFilename.isBlank()) {
            uploadRepository.findByFilename(activeFilename).ifPresent(targets::add);
        }

        if (targets.isEmpty()) {
            Optional<Upload> matched = findMatchingUpload(query);
            matched.ifPresent(targets::add);
        }

        if (targets.isEmpty()) {
            targets = uploadRepository.findAll();
        }

        if (targets.isEmpty()) {
            return "No uploaded documents found in workspace knowledge base.";
        }

        StringBuilder results = new StringBuilder();
        String[] keywords = query.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");

        for (Upload u : targets) {
            String fullText = extractDocumentText(u.getFilename());
            if (fullText.startsWith("File '") || fullText.startsWith("Error parsing")) {
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
            // Return first 1500 characters of the target document as default excerpt
            Upload first = targets.get(0);
            String text = extractDocumentText(first.getFilename());
            String excerpt = text.length() > 1500 ? text.substring(0, 1500) + "..." : text;
            return String.format("--- [Source: %s, Full Overview] ---\n%s\n", first.getFilename(), excerpt);
        }

        return results.toString();
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
