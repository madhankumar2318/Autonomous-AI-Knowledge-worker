package com.knowledge.worker.service;

import com.knowledge.worker.entity.AuditLog;
import com.knowledge.worker.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    private static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    /**
     * Records a tamper-evident audit log event.
     * Uses synchronized execution to preserve strict serial hash chaining.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public synchronized AuditLog recordEvent(String eventType, String username, String clientIp,
                                            String resource, String status, String details) {
        try {
            Instant now = Instant.now();
            String safeUsername = username != null && !username.isBlank() ? username : "anonymous";
            String safeIp = clientIp != null && !clientIp.isBlank() ? clientIp : "unknown";
            String safeResource = resource != null ? resource : "";
            String safeDetails = details != null ? details : "";

            // 1. Retrieve the previous hash in the chain
            String prevHash = auditLogRepository.findTop1ByOrderByIdDesc()
                    .map(AuditLog::getCurrentHash)
                    .orElse(GENESIS_HASH);

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

            // 3. Build and persist entity
            AuditLog auditLog = AuditLog.builder()
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

            AuditLog saved = auditLogRepository.save(auditLog);
            log.info("[AUDIT] [{}] [{}] user={} ip={} status={} res={}",
                    eventType, status, safeUsername, safeIp, status, safeResource);
            return saved;
        } catch (Exception e) {
            log.error("Failed to persist security audit event: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Verifies the cryptographic integrity of the entire audit chain from genesis to head.
     * Detects if any record was modified, deleted, or injected.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> verifyChainIntegrity() {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByIdAsc();
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
    @Transactional(readOnly = true)
    public List<AuditLog> getRecentLogs(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        return auditLogRepository.findAllByOrderByTimestampDesc(PageRequest.of(0, safeLimit));
    }

    /**
     * Calculates security summary statistics for the last 24 hours.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getAuditStats() {
        Instant past24Hours = Instant.now().minus(24, ChronoUnit.HOURS);

        long totalEvents = auditLogRepository.countByTimestampAfter(past24Hours);
        long blockedEvents = auditLogRepository.countByStatusAndTimestampAfter("BLOCKED", past24Hours);
        long failureEvents = auditLogRepository.countByStatusAndTimestampAfter("FAILURE", past24Hours);
        long rateLimitBlocks = auditLogRepository.countByEventTypeAndTimestampAfter("RATE_LIMIT_BLOCKED", past24Hours);
        long loginFailures = auditLogRepository.countByEventTypeAndTimestampAfter("AUTH_LOGIN_FAILURE", past24Hours);

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
