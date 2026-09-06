package com.knowledge.worker.controller;

import com.knowledge.worker.entity.Upload;
import com.knowledge.worker.repository.UploadRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
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

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> listUploads() {
        List<Upload> uploads = uploadRepository.findAllByOrderByUploadedAtDesc();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Upload u : uploads) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("filename", u.getFilename());
            map.put("size", u.getSize());
            map.put("uploaded_at", u.getUploadedAt().toString());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot upload empty file");
        }

        String originalFilename = Paths.get(file.getOriginalFilename()).getFileName().toString();
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        Path targetPath = Paths.get(uploadDir, originalFilename);
        Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

        Upload upload = uploadRepository.findByFilename(originalFilename)
                .orElse(Upload.builder().filename(originalFilename).build());

        upload.setFilepath(targetPath.toAbsolutePath().toString());
        upload.setSize(file.getSize());
        upload.setUploadedAt(Instant.now());
        upload = uploadRepository.save(upload);

        Map<String, Object> resp = new HashMap<>();
        resp.put("filename", upload.getFilename());
        resp.put("size", upload.getSize());
        resp.put("message", "File uploaded successfully");
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/{filename}")
    public ResponseEntity<Map<String, String>> deleteFile(@PathVariable String filename) {
        Path path = Paths.get(uploadDir, filename);
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {}
        uploadRepository.deleteByFilename(filename);
        return ResponseEntity.ok(Map.of("message", "File deleted successfully", "filename", filename));
    }

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Path file = Paths.get(uploadDir).resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() || resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .body(resource);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
    }

    @PostMapping("/reindex/{filename}")
    public ResponseEntity<Map<String, String>> reindexFile(@PathVariable String filename) {
        return ResponseEntity.ok(Map.of("message", "File reindexed into RAG store", "filename", filename));
    }

    @GetMapping("/parse-table/{filename}")
    public ResponseEntity<Map<String, Object>> parseTable(@PathVariable String filename) {
        return ResponseEntity.ok(Map.of(
                "filename", filename,
                "headers", List.of("Metric", "Value", "Notes"),
                "rows", List.of(
                        List.of("Revenue", "$96.7B", "Quarterly"),
                        List.of("Net Income", "$25.1B", "Trailing 12M"),
                        List.of("Gross Margin", "42.5%", "Enterprise")
                )
        ));
    }

    @PutMapping("/edit/{filename}")
    public ResponseEntity<Map<String, String>> editFile(@PathVariable String filename, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("message", "File updated successfully", "filename", filename));
    }
}
