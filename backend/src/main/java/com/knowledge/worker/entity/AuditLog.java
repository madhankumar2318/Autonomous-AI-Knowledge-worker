package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entity representing a tamper-evident security audit log entry.
 * Includes previous and current cryptographic SHA-256 hashes forming a blockchain-style
 * audit chain to guarantee that past records cannot be quietly modified or deleted.
 */
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
        @Index(name = "idx_audit_event_type", columnList = "eventType"),
        @Index(name = "idx_audit_username", columnList = "username")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false, length = 100)
    private String eventType;

    @Column(length = 255)
    private String username;

    @Column(length = 100)
    private String clientIp;

    @Column(length = 500)
    private String resource;

    @Column(nullable = false, length = 50)
    private String status; // SUCCESS, FAILURE, BLOCKED, WARNING

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false, length = 64)
    private String prevHash;

    @Column(nullable = false, length = 64)
    private String currentHash;
}
