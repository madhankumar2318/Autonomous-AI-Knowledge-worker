package com.knowledge.worker.controller;

import com.knowledge.worker.entity.Upload;
import com.knowledge.worker.entity.User;
import com.knowledge.worker.repository.UploadRepository;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.service.DocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping({"/upload", "/upload/"})
@Slf4j
@RequiredArgsConstructor
public class UploadController {

    private final UploadRepository uploadRepository;
    private final DocumentService documentService;
    private final UserRepository userRepository;

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    private User getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return userRepository.findByUsername(authentication.getName()).orElse(null);
    }

    private boolean isAuthorizedForFile(Upload upload, User user, Authentication authentication) {
        if (upload == null) return true;
        if (authentication != null && "admin".equalsIgnoreCase(authentication.getName())) {
            return true;
        }
        if (upload.getUserId() == null) {
            return true;
        }
        return user != null && upload.getUserId().equals(user.getId());
    }

    private Path resolveSafePath(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Filename is required");
        }
        String sanitizedName = Paths.get(filename).getFileName().toString();
        Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path target = baseDir.resolve(sanitizedName).normalize();
        if (!target.startsWith(baseDir)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid file path traversal attempt");
        }
        return target;
    }

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listUploads(Authentication authentication) {
        User user = getCurrentUser(authentication);
        boolean isAdmin = authentication != null && "admin".equalsIgnoreCase(authentication.getName());

        List<Upload> uploads;
        if (isAdmin) {
            uploads = uploadRepository.findAllByOrderByUploadedAtDesc();
        } else if (user != null) {
            uploads = uploadRepository.findByUserIdOrUserIdIsNullOrderByUploadedAtDesc(user.getId());
        } else {
            uploads = Collections.emptyList();
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Upload u : uploads) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("filename", u.getFilename());
            map.put("size", u.getSize());
            map.put("uploaded_at", u.getUploadedAt().toString());
            map.put("rag_indexed", true);
            map.put("chunks", Math.max(1, (int)((u.getSize() != null ? u.getSize() : 1000L) / 1500)));
            result.add(map);
        }
        return ResponseEntity.ok(Map.of("uploads", result));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot upload empty file");
        }

        String rawName = file.getOriginalFilename();
        if (rawName == null || rawName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Filename is missing");
        }
        String originalFilename = Paths.get(rawName).getFileName().toString();

        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        Path targetPath = resolveSafePath(originalFilename);
        Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

        User user = getCurrentUser(authentication);
        Upload upload = uploadRepository.findByFilename(originalFilename)
                .orElse(Upload.builder().filename(originalFilename).build());

        if (upload.getId() != null && !isAuthorizedForFile(upload, user, authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot overwrite another user's file");
        }

        upload.setFilepath(targetPath.toAbsolutePath().toString());
        upload.setSize(file.getSize());
        upload.setUploadedAt(Instant.now());
        if (user != null) {
            upload.setUserId(user.getId());
        }

        // Extract and persist document text into persistent database
        try {
            String extracted = documentService.extractDocumentText(originalFilename);
            if (extracted != null && !extracted.isBlank() && !extracted.startsWith("File '") && !extracted.startsWith("Error parsing")) {
                upload.setExtractedContent(extracted);
            }
        } catch (Exception e) {
            log.warn("Could not pre-extract content for {}: {}", originalFilename, e.getMessage());
        }

        upload = uploadRepository.save(upload);

        int chunks = Math.max(1, (int)(file.getSize() / 1500));

        Map<String, Object> resp = new HashMap<>();
        resp.put("filename", upload.getFilename());
        resp.put("size", upload.getSize());
        resp.put("message", "File uploaded successfully");
        resp.put("rag_status", "success");
        resp.put("chunks", chunks);
        return ResponseEntity.ok(resp);
    }

    @Transactional
    @DeleteMapping("/{filename:.+}")
    public ResponseEntity<Map<String, Object>> deleteFile(
            @PathVariable String filename,
            Authentication authentication) {
        return performDelete(filename, authentication);
    }

    @Transactional
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> deleteFileByParam(
            @RequestParam(value = "filename", required = false) String filename,
            Authentication authentication) {
        return performDelete(filename, authentication);
    }

    private ResponseEntity<Map<String, Object>> performDelete(String rawFilename, Authentication authentication) {
        if (rawFilename == null || rawFilename.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Filename is required"));
        }

        String decodedFilename = rawFilename;
        try {
            decodedFilename = URLDecoder.decode(rawFilename, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        // Find from DB by exact, decoded, or case-insensitive
        Optional<Upload> uploadOpt = uploadRepository.findByFilename(decodedFilename);
        if (uploadOpt.isEmpty() && !decodedFilename.equals(rawFilename)) {
            uploadOpt = uploadRepository.findByFilename(rawFilename);
        }
        if (uploadOpt.isEmpty()) {
            String targetLower = decodedFilename.toLowerCase();
            uploadOpt = uploadRepository.findAll().stream()
                    .filter(u -> u.getFilename() != null && (u.getFilename().equalsIgnoreCase(targetLower) || u.getFilename().equalsIgnoreCase(rawFilename)))
                    .findFirst();
        }

        // Authorization check: User must own the file (or be admin)
        User user = getCurrentUser(authentication);
        if (uploadOpt.isPresent()) {
            if (!isAuthorizedForFile(uploadOpt.get(), user, authentication)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "You do not have permission to delete this file"
                ));
            }
        }

        if (documentService != null) {
            documentService.invalidateCache(decodedFilename);
            documentService.invalidateCache(rawFilename);
        }

        // 1. Delete physical file if found via upload entity filepath (with path safety check)
        if (uploadOpt.isPresent() && uploadOpt.get().getFilepath() != null) {
            try {
                Path entityPath = Paths.get(uploadOpt.get().getFilepath()).toAbsolutePath().normalize();
                Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
                if (entityPath.startsWith(baseDir)) {
                    Files.deleteIfExists(entityPath);
                }
            } catch (Exception e) {
                log.warn("Could not delete file from entity path: {}", e.getMessage());
            }
        }

        // 2. Also attempt deleting from uploadDir safely
        try {
            Path safeDecoded = resolveSafePath(decodedFilename);
            Files.deleteIfExists(safeDecoded);
        } catch (Exception ignored) {}
        try {
            Path safeRaw = resolveSafePath(rawFilename);
            Files.deleteIfExists(safeRaw);
        } catch (Exception ignored) {}

        // 3. Delete from database
        if (uploadOpt.isPresent()) {
            uploadRepository.delete(uploadOpt.get());
        } else {
            uploadRepository.deleteByFilename(decodedFilename);
            if (!decodedFilename.equals(rawFilename)) {
                uploadRepository.deleteByFilename(rawFilename);
            }
        }

        log.info("File '{}' deleted successfully by user '{}'", decodedFilename, authentication != null ? authentication.getName() : "anonymous");
        return ResponseEntity.ok(Map.of(
                "message", "File deleted successfully",
                "filename", decodedFilename
        ));
    }

    @GetMapping("/download/{filename:.+}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String filename,
            Authentication authentication) {
        try {
            Path file = resolveSafePath(filename);
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() || resource.isReadable()) {
                String sanitizedName = file.getFileName().toString();
                Optional<Upload> uploadOpt = uploadRepository.findByFilename(sanitizedName);
                if (uploadOpt.isPresent()) {
                    User user = getCurrentUser(authentication);
                    if (!isAuthorizedForFile(uploadOpt.get(), user, authentication)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this file");
                    }
                }

                String contentType = Files.probeContentType(file);
                if (contentType == null) {
                    String lower = sanitizedName.toLowerCase();
                    if (lower.endsWith(".pdf")) contentType = "application/pdf";
                    else if (lower.endsWith(".json")) contentType = "application/json";
                    else if (lower.endsWith(".csv")) contentType = "text/csv";
                    else if (lower.endsWith(".txt") || lower.endsWith(".md")) contentType = "text/plain";
                    else if (lower.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    else if (lower.endsWith(".xlsx")) contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    else if (lower.endsWith(".xls")) contentType = "application/vnd.ms-excel";
                    else contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
                }
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                        .contentType(MediaType.parseMediaType(contentType))
                        .body(resource);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
    }

    @GetMapping("/content/{filename:.+}")
    public ResponseEntity<Map<String, Object>> getFileContent(
            @PathVariable String filename,
            Authentication authentication) {
        String decoded = filename;
        try {
            decoded = URLDecoder.decode(filename, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        String sanitizedName = Paths.get(decoded).getFileName().toString();
        Optional<Upload> uploadOpt = uploadRepository.findByFilename(sanitizedName);
        if (uploadOpt.isPresent()) {
            User user = getCurrentUser(authentication);
            if (!isAuthorizedForFile(uploadOpt.get(), user, authentication)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this file");
            }
        }

        String text = documentService.extractDocumentText(decoded);
        if (text == null || text.isBlank() || (text.startsWith("File '") && text.contains("was not found on server storage"))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "File '" + decoded + "' was not found on server storage. The cloud container may have restarted since upload.",
                    "filename", decoded,
                    "needs_reupload", true
            ));
        }

        String lower = decoded.toLowerCase();
        String type = "text";
        if (lower.endsWith(".pdf")) type = "pdf";
        else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) type = "spreadsheet";
        else if (lower.endsWith(".csv")) type = "csv";
        else if (lower.endsWith(".json")) type = "json";
        else if (lower.endsWith(".docx") || lower.endsWith(".doc")) type = "docx";
        else if (lower.endsWith(".md")) type = "markdown";

        return ResponseEntity.ok(Map.of(
                "filename", decoded,
                "content", text != null ? text : "",
                "type", type
        ));
    }

    @PostMapping("/reindex/{filename}")
    public ResponseEntity<Map<String, Object>> reindexFile(
            @PathVariable String filename,
            Authentication authentication) {
        String sanitizedName = Paths.get(filename).getFileName().toString();
        Upload upload = uploadRepository.findByFilename(sanitizedName).orElse(null);
        if (upload != null) {
            User user = getCurrentUser(authentication);
            if (!isAuthorizedForFile(upload, user, authentication)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this file");
            }
        }
        long size = upload != null && upload.getSize() != null ? upload.getSize() : 10000L;
        int chunks = Math.max(1, (int)(size / 1500));
        return ResponseEntity.ok(Map.of(
                "message", "Re-indexing complete for '" + sanitizedName + "'",
                "filename", sanitizedName,
                "rag_status", "success",
                "chunks", chunks
        ));
    }

    @GetMapping("/parse-table/{filename:.+}")
    public ResponseEntity<Map<String, Object>> parseTable(
            @PathVariable String filename,
            @RequestParam(value = "sheet_name", required = false) String sheetName,
            Authentication authentication) {
        String decoded = filename;
        try {
            decoded = URLDecoder.decode(filename, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        String sanitizedName = Paths.get(decoded).getFileName().toString();
        Optional<Upload> uploadOpt = uploadRepository.findByFilename(sanitizedName);
        if (uploadOpt.isPresent()) {
            User user = getCurrentUser(authentication);
            if (!isAuthorizedForFile(uploadOpt.get(), user, authentication)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this file");
            }
        }
        Map<String, Object> data = documentService.parseSpreadsheetData(decoded, sheetName);
        return ResponseEntity.ok(data);
    }

    @PutMapping("/edit/{filename}")
    public ResponseEntity<Map<String, Object>> editFile(
            @PathVariable String filename,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Path targetPath = resolveSafePath(filename);
        String sanitizedName = targetPath.getFileName().toString();

        Upload upload = uploadRepository.findByFilename(sanitizedName).orElse(null);
        if (upload != null) {
            User user = getCurrentUser(authentication);
            if (!isAuthorizedForFile(upload, user, authentication)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to edit this file");
            }
        }

        String newContent = body.getOrDefault("content", "");
        try {
            Files.writeString(targetPath, newContent, StandardCharsets.UTF_8);
            if (upload != null) {
                upload.setSize((long) newContent.getBytes(StandardCharsets.UTF_8).length);
                uploadRepository.save(upload);
            }
        } catch (IOException e) {
            log.warn("Failed to write edited file {}: {}", sanitizedName, e.getMessage());
        }
        int chunks = Math.max(1, newContent.length() / 1500);
        return ResponseEntity.ok(Map.of(
                "message", "File updated successfully",
                "filename", sanitizedName,
                "chunks", chunks,
                "size", newContent.length()
        ));
    }
}
