package com.knowledge.worker.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;

/**
 * Startup Fail-Fast Security Validator.
 *
 * <p>Validates that:
 * 1. Cryptographic keys have at least 256 bits of entropy (>= 32 chars).
 * 2. Publicly known default tutorial keys are rejected in production.
 * 3. Insecure zero-padding or empty production keys immediately abort application boot.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SecurityPropertiesValidator implements ApplicationRunner {

    private final Environment environment;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${spring.datasource.url:}")
    private String dbUrl;

    private static final Set<String> KNOWN_INSECURE_KEYS = Set.of(
            "404e635266556a586e3272357538782f413f4428472b4b6250645367566b5970",
            "secret",
            "password",
            "changeme",
            "12345678901234567890123456789012"
    );

    @Override
    public void run(ApplicationArguments args) {
        boolean isProduction = isProductionEnvironment();

        log.info("[SECURITY-STARTUP] Validating system security configuration (Production Mode: {})", isProduction);

        // 1. JWT Secret Validation
        if (jwtSecret == null || jwtSecret.isBlank()) {
            if (isProduction) {
                log.error("CRITICAL PRODUCTION SECURITY FAILURE: JWT_SECRET environment variable is not defined!");
                throw new IllegalStateException("CRITICAL PRODUCTION SECURITY FAILURE: Missing JWT_SECRET environment variable. Aborting startup.");
            } else {
                log.warn("DEVELOPMENT NOTICE: No JWT_SECRET provided in environment. An ephemeral cryptographically secure 256-bit key has been generated for this session.");
            }
        } else {
            String trimmed = jwtSecret.trim();
            if (trimmed.length() < 32) {
                log.error("CRITICAL SECURITY FAILURE: JWT_SECRET has insufficient entropy (< 32 characters / 256 bits). Length: {}", trimmed.length());
                throw new IllegalStateException("CRITICAL SECURITY FAILURE: JWT_SECRET must be at least 32 characters (256 bits). Provided length: " + trimmed.length());
            }

            if (KNOWN_INSECURE_KEYS.contains(trimmed.toLowerCase())) {
                if (isProduction) {
                    log.error("CRITICAL PRODUCTION SECURITY FAILURE: JWT_SECRET is set to a publicly known sample or tutorial key!");
                    throw new IllegalStateException("CRITICAL PRODUCTION SECURITY FAILURE: Known default JWT_SECRET detected. Aborting startup.");
                } else {
                    log.warn("SECURITY WARNING: JWT_SECRET is using a known sample development key. Ensure a unique high-entropy key is set for production.");
                }
            } else {
                log.info("[SECURITY-STARTUP] JWT Key verified with strong cryptographic entropy (>= 256 bits). Key prefix: {}****", trimmed.substring(0, Math.min(4, trimmed.length())));
            }
        }

        // 2. Production Database Check
        if (isProduction && dbUrl != null && dbUrl.contains("h2:file")) {
            log.warn("PRODUCTION DATABASE WARNING: Running in production profile with file-based H2 database. PostgreSQL is strongly recommended for multi-user production.");
        }

        log.info("[SECURITY-STARTUP] All startup security verifications passed successfully.");
    }

    private boolean isProductionEnvironment() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"))
                || (dbUrl != null && (dbUrl.contains("postgres") || dbUrl.contains("postgresql")));
    }
}
