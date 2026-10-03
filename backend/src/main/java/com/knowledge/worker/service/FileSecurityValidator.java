package com.knowledge.worker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

/**
 * Validates uploaded files for security threats:
 * - Extension whitelisting (only known document types accepted)
 * - Magic byte (MIME sniffing) verification to block spoofed uploads
 * - Null-byte injection detection for text files
 */
@Component
@Slf4j
public class FileSecurityValidator {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "docx", "doc", "xlsx", "xls", "csv", "json", "txt", "md"
    );

    // Magic byte signatures
    private static final byte[] MAGIC_PDF   = {0x25, 0x50, 0x44, 0x46, 0x2D};  // %PDF-
    private static final byte[] MAGIC_ZIP   = {0x50, 0x4B, 0x03, 0x04};         // PK\x03\x04 (DOCX, XLSX)
    private static final byte[] MAGIC_OLE2  = {(byte)0xD0, (byte)0xCF, 0x11, (byte)0xE0}; // OLE2 (DOC, XLS)

    /**
     * Validates the uploaded file for:
     * 1. Extension whitelist
     * 2. Magic byte / MIME sniffing
     * Throws {@link ResponseStatusException} with HTTP 400 on any violation.
     */
    public void validateFile(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File must have a valid filename.");
        }

        String extension = getExtension(originalFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            log.warn("Blocked upload with disallowed extension: {}", originalFilename);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "File type '." + extension + "' is not allowed. Accepted types: pdf, docx, doc, xlsx, xls, csv, json, txt, md.");
        }

        byte[] header = readHeader(file, 8);

        switch (extension) {
            case "pdf" -> {
                if (!startsWith(header, MAGIC_PDF)) {
                    log.warn("Blocked spoofed PDF upload: {}", originalFilename);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "File '" + originalFilename + "' does not appear to be a valid PDF (magic bytes mismatch).");
                }
            }
            case "docx", "xlsx" -> {
                if (!startsWith(header, MAGIC_ZIP)) {
                    log.warn("Blocked spoofed DOCX/XLSX upload (expected ZIP/PK header): {}", originalFilename);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "File '" + originalFilename + "' does not appear to be a valid Office Open XML document.");
                }
            }
            case "doc", "xls" -> {
                if (!startsWith(header, MAGIC_OLE2)) {
                    log.warn("Blocked spoofed DOC/XLS upload (expected OLE2 header): {}", originalFilename);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "File '" + originalFilename + "' does not appear to be a valid legacy Office document.");
                }
            }
            case "csv", "json", "txt", "md" -> {
                // Text files must not contain null bytes — a hallmark of binary disguised as text
                for (byte b : header) {
                    if (b == 0x00) {
                        log.warn("Blocked binary file disguised as text: {}", originalFilename);
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "File '" + originalFilename + "' appears to be binary, not a valid text file.");
                    }
                }
            }
            default -> {
                // Already blocked by extension whitelist above; this is a safety catch-all
                log.warn("Unexpected extension reached magic-byte check: {}", extension);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file type.");
            }
        }

        log.debug("File passed security validation: {} ({} bytes)", originalFilename, file.getSize());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String getExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase();
    }

    private byte[] readHeader(MultipartFile file, int length) {
        try (InputStream is = file.getInputStream()) {
            byte[] buf = new byte[length];
            int read = is.read(buf, 0, length);
            if (read < 4) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is too small to be a valid document.");
            }
            return buf;
        } catch (IOException e) {
            log.error("Could not read file header for magic byte check: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read uploaded file.");
        }
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
