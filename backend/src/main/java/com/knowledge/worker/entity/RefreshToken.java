package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_family", columnList = "family_id"),
        @Index(name = "idx_refresh_user", columnList = "username")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String username;

    @Column(nullable = false, unique = true, columnDefinition = "TEXT")
    private String token;

    @Column(name = "family_id", length = 64)
    private String familyId;

    @Column(name = "device_type", length = 30)
    private String deviceType;

    @Column(name = "os", length = 50)
    private String os;

    @Column(name = "browser", length = 50)
    private String browser;

    @Column(name = "ip_address", length = 60)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "last_active_at")
    @Builder.Default
    private Instant lastActiveAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
    private boolean revoked = false;

    @Column(name = "replaced_by_token", columnDefinition = "TEXT")
    private String replacedByToken;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
