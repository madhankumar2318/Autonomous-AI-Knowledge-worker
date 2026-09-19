package com.knowledge.worker.controller;

import com.knowledge.worker.service.AuditService;
import com.knowledge.worker.service.AuditService.AuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/audit", "/audit/"})
@Slf4j
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    private void requireAdmin(Authentication authentication) {
        if (authentication == null || authentication.getName() == null ||
                !"admin".equalsIgnoreCase(authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrative privileges required.");
        }
    }

    /**
     * Retrieve recent security audit logs.
     */
    @GetMapping("/logs")
    public ResponseEntity<Map<String, Object>> getLogs(
            @RequestParam(defaultValue = "50") int limit,
            Authentication authentication) {
        requireAdmin(authentication);
        List<AuditLog> logs = auditService.getRecentLogs(limit);
        return ResponseEntity.ok(Map.of(
                "totalReturned", logs.size(),
                "logs", logs
        ));
    }

    /**
     * Retrieve security telemetry statistics for the past 24 hours.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(Authentication authentication) {
        requireAdmin(authentication);
        return ResponseEntity.ok(auditService.getAuditStats());
    }

    /**
     * Cryptographically verify the SHA-256 hash chain of the audit database from genesis to head.
     */
    @GetMapping("/verify-integrity")
    public ResponseEntity<Map<String, Object>> verifyIntegrity(Authentication authentication) {
        requireAdmin(authentication);
        return ResponseEntity.ok(auditService.verifyChainIntegrity());
    }
}
