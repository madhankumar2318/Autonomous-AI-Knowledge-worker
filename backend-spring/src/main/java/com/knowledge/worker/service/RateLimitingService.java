package com.knowledge.worker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe In-Memory Token-Bucket Rate Limiter & Concurrency Manager.
 * Protects server resources, worker threads, and external LLM API budgets.
 */
@Service
@Slf4j
public class RateLimitingService {

    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicInteger> activeStreams = new ConcurrentHashMap<>();

    private static class TokenBucket {
        private final double capacity;
        private final double refillRatePerMs;
        private double availableTokens;
        private long lastRefillTimeMs;

        public TokenBucket(double maxTokens, long refillDurationSeconds) {
            this.capacity = maxTokens;
            this.refillRatePerMs = maxTokens / (refillDurationSeconds * 1000.0);
            this.availableTokens = maxTokens;
            this.lastRefillTimeMs = System.currentTimeMillis();
        }

        public synchronized boolean tryConsume(double tokens) {
            refill();
            if (availableTokens >= tokens) {
                availableTokens -= tokens;
                return true;
            }
            return false;
        }

        public synchronized long getSecondsUntilAvailable(double tokens) {
            refill();
            if (availableTokens >= tokens) {
                return 0;
            }
            double needed = tokens - availableTokens;
            long waitMs = (long) Math.ceil(needed / refillRatePerMs);
            return Math.max(1, waitMs / 1000);
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTimeMs;
            if (elapsed > 0) {
                availableTokens = Math.min(capacity, availableTokens + (elapsed * refillRatePerMs));
                lastRefillTimeMs = now;
            }
        }
    }

    /**
     * Enforce chat rate limit (10 prompts / 60 seconds).
     * Admin accounts bypass rate limits.
     */
    public void checkChatRateLimit(String username) {
        if (isAdmin(username)) {
            return;
        }
        String key = "chat:" + normalizeKey(username);
        TokenBucket bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(10.0, 60));

        if (!bucket.tryConsume(1.0)) {
            long waitSec = bucket.getSecondsUntilAvailable(1.0);
            log.warn("Rate limit exceeded for chat user '{}'. Wait {}s", username, waitSec);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Chat rate limit reached: You can send up to 10 messages per minute. Please wait " + waitSec + " seconds before sending another prompt."
            );
        }
    }

    /**
     * Enforce maximum concurrent SSE streaming connections (max 1 active stream per user).
     * Prevents users or malicious scripts from opening multiple tabs and saturating Groq/Gemini tokens.
     */
    public void acquireStreamLock(String username) {
        if (isAdmin(username)) {
            return;
        }
        String key = normalizeKey(username);
        AtomicInteger counter = activeStreams.computeIfAbsent(key, k -> new AtomicInteger(0));
        int active = counter.incrementAndGet();

        if (active > 1) {
            counter.decrementAndGet();
            log.warn("Concurrent stream blocked for user '{}'. Already active: {}", username, active - 1);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "An AI response is already streaming for your account. Please wait for it to finish before starting a new one."
            );
        }
        log.debug("Stream lock acquired for user '{}' (active: {})", username, active);
    }

    /**
     * Release active stream lock on completion, error, or timeout.
     */
    public void releaseStreamLock(String username) {
        if (isAdmin(username) || username == null) {
            return;
        }
        String key = normalizeKey(username);
        AtomicInteger counter = activeStreams.get(key);
        if (counter != null) {
            int remaining = counter.decrementAndGet();
            if (remaining <= 0) {
                counter.set(0);
            }
            log.debug("Stream lock released for user '{}' (remaining: {})", username, Math.max(0, remaining));
        }
    }

    /**
     * Enforce file upload rate limit (5 uploads / 60 seconds).
     */
    public void checkUploadRateLimit(String username) {
        if (isAdmin(username)) {
            return;
        }
        String key = "upload:" + normalizeKey(username);
        TokenBucket bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(5.0, 60));

        if (!bucket.tryConsume(1.0)) {
            long waitSec = bucket.getSecondsUntilAvailable(1.0);
            log.warn("Rate limit exceeded for uploads by user '{}'. Wait {}s", username, waitSec);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Upload rate limit reached: You can upload up to 5 files per minute. Please wait " + waitSec + " seconds."
            );
        }
    }

    /**
     * Enforce login brute-force protection (5 attempts / 60 seconds per IP address).
     */
    public void checkLoginRateLimit(String clientIp) {
        String safeIp = (clientIp != null && !clientIp.isBlank()) ? clientIp.trim() : "unknown";
        String key = "login:" + safeIp;
        TokenBucket bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(5.0, 60));

        if (!bucket.tryConsume(1.0)) {
            long waitSec = bucket.getSecondsUntilAvailable(1.0);
            log.warn("Brute-force login limit triggered for IP '{}'. Wait {}s", safeIp, waitSec);
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many login attempts from your IP address. Please wait " + waitSec + " seconds before trying again."
            );
        }
    }

    private boolean isAdmin(String username) {
        return username != null && "admin".equalsIgnoreCase(username.trim());
    }

    private String normalizeKey(String key) {
        return key != null ? key.trim().toLowerCase() : "anonymous";
    }
}
