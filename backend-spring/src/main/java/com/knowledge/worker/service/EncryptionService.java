package com.knowledge.worker.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * EncryptionService
 *
 * AES-256-GCM authenticated encryption for PII fields stored in the database.
 * Key source: DB_ENCRYPTION_KEY env-var (app.encryption.key in YAML).
 * Dev fallback: ephemeral SecureRandom key per session.
 */
@Service
@Slf4j
public class EncryptionService {

    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    @Value("${app.encryption.key:}")
    private String encryptionKeyRaw;

    private final Environment environment;
    private SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public EncryptionService(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void initKey() throws Exception {
        boolean isProduction = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));

        if (encryptionKeyRaw == null || encryptionKeyRaw.isBlank()) {
            if (isProduction) {
                throw new IllegalStateException(
                        "CRITICAL PRODUCTION SECURITY FAILURE: DB_ENCRYPTION_KEY environment variable is not set. " +
                        "All PII fields require encryption at rest. Aborting startup.");
            }
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256, secureRandom);
            secretKey = keyGen.generateKey();
            log.warn("[SECURITY-STARTUP] DB_ENCRYPTION_KEY not set. Using an ephemeral session key for PII encryption. " +
                     "Data encrypted this session CANNOT be decrypted after restart. Set DB_ENCRYPTION_KEY for persistence.");
        } else {
            String trimmed = encryptionKeyRaw.trim();
            if (trimmed.length() < 32) {
                throw new IllegalStateException(
                        "CRITICAL SECURITY FAILURE: DB_ENCRYPTION_KEY must be at least 32 characters. " +
                        "Provided length: " + trimmed.length());
            }
            // Derive a 256-bit AES key via SHA-256 so any passphrase works
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(trimmed.getBytes(StandardCharsets.UTF_8));
            secretKey = new SecretKeySpec(keyBytes, "AES");
            log.info("[SECURITY-STARTUP] DB_ENCRYPTION_KEY loaded. AES-256-GCM encryption active for PII fields.");
        }
    }

    /** Encrypt plaintext → Base64( 12-byte-IV | ciphertext+GCM-tag ) */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            ByteBuffer buffer = ByteBuffer.allocate(IV_LENGTH_BYTES + ciphertext.length);
            buffer.put(iv);
            buffer.put(ciphertext);
            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception e) {
            throw new IllegalStateException("PII encryption failed", e);
        }
    }

    /** Decrypt Base64-encoded AES-256-GCM ciphertext produced by encrypt(). */
    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return ciphertext;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(ciphertext);
            ByteBuffer buffer = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[IV_LENGTH_BYTES];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("[ENCRYPTION] Failed to decrypt field — may be legacy plaintext row. Returning empty string.");
            return "";
        }
    }
}
