package com.knowledge.worker.service;

import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditService {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuditLog {
        private Long id;
        private Instant timestamp;
        private String eventType;
        private String username;
        private String clientIp;
        private String resource;
        private String status;
        private String details;
        private String prevHash;
        private String currentHash;
    }

    private final List<AuditLog> auditLogs = Collections.synchronizedList(new ArrayList<>());
    private final AtomicLong idGenerator = new AtomicLong(1);

    private static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    /**
     * Records a tamper-evident audit log event.
     * Uses synchronized execution to preserve strict serial hash chaining.
     */
    public synchronized AuditLog recordEvent(String eventType, String username, String clientIp,
                                            String resource, String status, String details) {
        try {
            Instant now = Instant.now();
            String safeUsername = username != null && !username.isBlank() ? username : "anonymous";
            String safeIp = clientIp != null && !clientIp.isBlank() ? clientIp : "unknown";
            String safeResource = resource != null ? resource : "";
            String safeDetails = details != null ? details : "";

            // 1. Retrieve the previous hash in the chain
            String prevHash;
            synchronized (auditLogs) {
                prevHash = auditLogs.isEmpty()
                        ? GENESIS_HASH
                        : auditLogs.get(auditLogs.size() - 1).getCurrentHash();
            }

            // 2. Compute current record hash
            String payloadToHash = String.join(":",
                    prevHash,
                    now.toString(),
                    eventType,
                    safeUsername,
                    safeIp,
                    safeResource,
                    status,
                    safeDetails
            );
            String currentHash = calculateSha256(payloadToHash);

            // 3. Build and record in-memory audit log
            AuditLog auditLog = AuditLog.builder()
                    .id(idGenerator.getAndIncrement())
                    .timestamp(now)
                    .eventType(eventType)
                    .username(safeUsername)
                    .clientIp(safeIp)
                    .resource(safeResource)
                    .status(status)
                    .details(safeDetails)
                    .prevHash(prevHash)
                    .currentHash(currentHash)
                    .build();

            auditLogs.add(auditLog);
            if (auditLogs.size() > 5000) {
                auditLogs.remove(0);
            }

            log.info("[AUDIT] [{}] [{}] user={} ip={} status={} res={}",
                    eventType, status, safeUsername, safeIp, status, safeResource);
            return auditLog;
        } catch (Exception e) {
            log.error("Failed to record security audit event: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Verifies the cryptographic integrity of the entire audit chain from genesis to head.
     * Detects if any record was modified, deleted, or injected.
     */
    public Map<String, Object> verifyChainIntegrity() {
        List<AuditLog> logs;
        synchronized (auditLogs) {
            logs = new ArrayList<>(auditLogs);
        }
        Map<String, Object> result = new HashMap<>();

        if (logs.isEmpty()) {
            result.put("status", "VALID");
            result.put("totalRecords", 0);
            result.put("message", "Audit log is empty. Genesis state intact.");
            return result;
        }

        String expectedPrevHash = GENESIS_HASH;
        for (int i = 0; i < logs.size(); i++) {
            AuditLog current = logs.get(i);

            // 1. Verify that prevHash matches the previous record's currentHash
            if (!current.getPrevHash().equals(expectedPrevHash)) {
                log.error("[AUDIT INTEGRITY BREACH] Broken chain at record id={}. Expected prevHash={}, got={}",
                        current.getId(), expectedPrevHash, current.getPrevHash());
                result.put("status", "COMPROMISED");
                result.put("compromisedRecordId", current.getId());
                result.put("reason", "Chain link mismatch at record ID " + current.getId());
                result.put("totalChecked", i + 1);
                return result;
            }

            // 2. Recompute hash of current record
            String payloadToHash = String.join(":",
                    current.getPrevHash(),
                    current.getTimestamp().toString(),
                    current.getEventType(),
                    current.getUsername(),
                    current.getClientIp(),
                    current.getResource() != null ? current.getResource() : "",
                    current.getStatus(),
                    current.getDetails() != null ? current.getDetails() : ""
            );
            String recomputedHash = calculateSha256(payloadToHash);

            if (!recomputedHash.equals(current.getCurrentHash())) {
                log.error("[AUDIT INTEGRITY BREACH] Content tampered at record id={}. Stored hash={}, calculated={}",
                        current.getId(), current.getCurrentHash(), recomputedHash);
                result.put("status", "COMPROMISED");
                result.put("compromisedRecordId", current.getId());
                result.put("reason", "Data content tampering detected at record ID " + current.getId());
                result.put("totalChecked", i + 1);
                return result;
            }

            expectedPrevHash = current.getCurrentHash();
        }

        result.put("status", "VALID");
        result.put("totalRecords", logs.size());
        result.put("headHash", expectedPrevHash);
        result.put("message", "All " + logs.size() + " audit records cryptographically verified. Hash chain is intact.");
        return result;
    }

    /**
     * Retrieves recent audit logs (most recent first).
     */
    public List<AuditLog> getRecentLogs(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        List<AuditLog> copy;
        synchronized (auditLogs) {
            copy = new ArrayList<>(auditLogs);
        }
        Collections.reverse(copy);
        return copy.subList(0, Math.min(safeLimit, copy.size()));
    }

    /**
     * Calculates security summary statistics for the last 24 hours.
     */
    public Map<String, Object> getAuditStats() {
        Instant past24Hours = Instant.now().minus(24, ChronoUnit.HOURS);
        List<AuditLog> copy;
        synchronized (auditLogs) {
            copy = new ArrayList<>(auditLogs);
        }

        long totalEvents = copy.stream().filter(l -> l.getTimestamp().isAfter(past24Hours)).count();
        long blockedEvents = copy.stream().filter(l -> "BLOCKED".equalsIgnoreCase(l.getStatus()) && l.getTimestamp().isAfter(past24Hours)).count();
        long failureEvents = copy.stream().filter(l -> "FAILURE".equalsIgnoreCase(l.getStatus()) && l.getTimestamp().isAfter(past24Hours)).count();
        long rateLimitBlocks = copy.stream().filter(l -> "RATE_LIMIT_BLOCKED".equalsIgnoreCase(l.getEventType()) && l.getTimestamp().isAfter(past24Hours)).count();
        long loginFailures = copy.stream().filter(l -> "AUTH_LOGIN_FAILURE".equalsIgnoreCase(l.getEventType()) && l.getTimestamp().isAfter(past24Hours)).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("timeframe", "Last 24 Hours");
        stats.put("totalEvents24h", totalEvents);
        stats.put("blockedThreats24h", blockedEvents);
        stats.put("authFailures24h", failureEvents);
        stats.put("rateLimitTriggers24h", rateLimitBlocks);
        stats.put("loginFailures24h", loginFailures);

        return stats;
    }

    private String calculateSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }
}
