package com.knowledge.worker.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class SystemController {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @GetMapping("/")
    public ResponseEntity<Map<String, String>> root() {
        return ResponseEntity.ok(Map.of(
                "message", "Spring Boot Backend running ✅. Use /news, /stock, /search, /auth, /chat"
        ));
    }

    @RequestMapping(value = "/", method = RequestMethod.HEAD)
    public ResponseEntity<Void> rootHead() {
        return ResponseEntity.ok().build();
    }

    @GetMapping("/db/status")
    public ResponseEntity<Map<String, String>> dbStatus() {
        String dbType = dbUrl.contains("postgresql") ? "postgres" : (dbUrl.contains("h2") ? "h2" : "database");
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "database", dbType
        ));
    }
}
