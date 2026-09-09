package com.knowledge.worker.service;

import com.knowledge.worker.entity.Upload;
import com.knowledge.worker.repository.UploadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
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
     * Find an uploaded file by exact or fuzzy filename matching.
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
            if (u.getFilename().equalsIgnoreCase(clean)) {
                return Optional.of(u);
            }
        }

        // 2. Normalized alphanumeric match (e.g. "MadhansResume1.pdf" vs "Madhans_Resume_1.pdf")
        for (Upload u : all) {
            String normU = u.getFilename().toLowerCase().replaceAll("[^a-z0-9]", "");
            if (normU.equals(normalizedQuery) || normalizedQuery.contains(normU) || normU.contains(normalizedQuery)) {
                return Optional.of(u);
            }
        }

        // 3. Keyword / prefix match (e.g. "resume", "pdf", etc.)
        for (Upload u : all) {
            String uName = u.getFilename().toLowerCase();
            String[] tokens = clean.split("\\s+");
            for (String tok : tokens) {
                if (tok.length() >= 4 && uName.contains(tok)) {
                    return Optional.of(u);
                }
            }
        }

        // 4. If query mentions "resume" or "cv" and there's a resume file
        if (clean.contains("resume") || clean.contains("cv")) {
            for (Upload u : all) {
                String uName = u.getFilename().toLowerCase();
                if (uName.contains("resume") || uName.contains("cv")) {
                    return Optional.of(u);
                }
            }
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
            // Try resolving via absolute path in DB
            Optional<Upload> up = uploadRepository.findByFilename(filename);
            if (up.isPresent() && up.get().getFilepath() != null) {
                file = new File(up.get().getFilepath());
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
