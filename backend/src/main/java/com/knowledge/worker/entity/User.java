package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 255)
    private String username;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String password;

    @Column(columnDefinition = "TEXT")
    private String name;

    @Column(columnDefinition = "TEXT")
    private String email;

    @Column(columnDefinition = "TEXT")
    private String mobile;

    @Column(name = "avatar", columnDefinition = "TEXT")
    private String avatar;

    @Column(name = "default_starting_screen", length = 50)
    @Builder.Default
    private String defaultStartingScreen = "news";

    @Column(name = "time_format", length = 10)
    @Builder.Default
    private String timeFormat = "12h";

    @Column(name = "date_format", length = 20)
    @Builder.Default
    private String dateFormat = "DD/MM/YYYY";

    @Column(name = "sound_effects")
    @Builder.Default
    private Boolean soundEffects = true;

    @Builder.Default
    @Column(name = "failed_login_attempts", nullable = false, columnDefinition = "integer default 0")
    private int failedLoginAttempts = 0;

    @Builder.Default
    @Column(name = "account_locked", nullable = false, columnDefinition = "boolean default false")
    private boolean accountLocked = false;

    @Column(name = "lockout_expiry")
    private Instant lockoutExpiry;
}
