package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;

public class AuthDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisterRequest {
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
        @Pattern(regexp = "^[a-zA-Z0-9_.\\-]+$", message = "Username may only contain letters, digits, '_', '.', or '-'")
        private String username;

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
        private String password;

        @Size(max = 100, message = "Name must not exceed 100 characters")
        private String name;

        @Email(message = "Email must be a valid address")
        @Size(max = 150, message = "Email must not exceed 150 characters")
        private String email;

        @Size(max = 30, message = "Mobile must not exceed 30 characters")
        private String mobile;
        private String avatar;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        @NotBlank(message = "Username is required")
        @Size(max = 100, message = "Username must not exceed 100 characters")
        private String username;

        @NotBlank(message = "Password is required")
        @Size(max = 256, message = "Password must not exceed 256 characters")
        private String password;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuthResponse {
        @JsonProperty("access_token")
        private String accessToken;

        @JsonProperty("token")
        public String getToken() {
            return accessToken;
        }

        @JsonProperty("token_type")
        @Builder.Default
        private String tokenType = "bearer";
        @JsonProperty("refresh_token")
        private String refreshToken;
        private String username;
        private String name;
        private String email;
        private String mobile;
        private String avatar;
        @JsonProperty("default_starting_tab")
        private String defaultStartingTab;
        @JsonProperty("time_format")
        private String timeFormat;
        @JsonProperty("date_format")
        private String dateFormat;
        @JsonProperty("sound_effects")
        private Boolean soundEffects;
        @JsonProperty("session_id")
        private String sessionId;
        private String message;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class VerifyResponse {
        private boolean valid;
        private String username;
        private UserDto user;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDto {
        private String username;
        private String name;
        private String email;
        private String mobile;
        private String avatar;
        @JsonProperty("default_starting_tab")
        private String defaultStartingTab;
        @JsonProperty("time_format")
        private String timeFormat;
        @JsonProperty("date_format")
        private String dateFormat;
        @JsonProperty("sound_effects")
        private Boolean soundEffects;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProfileUpdateRequest {
        @Size(max = 100, message = "Name must not exceed 100 characters")
        private String name;

        @Email(message = "Email must be a valid address")
        @Size(max = 150, message = "Email must not exceed 150 characters")
        private String email;

        @Size(max = 30, message = "Mobile must not exceed 30 characters")
        private String mobile;

        private String avatar;

        @JsonProperty("default_starting_tab")
        private String defaultStartingTab;

        @JsonProperty("time_format")
        private String timeFormat;

        @JsonProperty("date_format")
        private String dateFormat;

        @JsonProperty("sound_effects")
        private Boolean soundEffects;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeviceSessionDto {
        private String id;
        @JsonProperty("device_type")
        private String deviceType;
        private String os;
        private String browser;
        private String ip;
        @JsonProperty("last_active_at")
        private long lastActiveAt;
        @JsonProperty("created_at")
        private long createdAt;
        @JsonProperty("is_current")
        private boolean isCurrent;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeviceActionRequest {
        private String action;
        @JsonProperty("session_id")
        private String sessionId;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PasswordChangeRequest {
        @NotBlank(message = "Current password is required")
        @JsonProperty("current_password")
        private String currentPassword;

        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 128, message = "New password must be between 8 and 128 characters")
        @JsonProperty("new_password")
        private String newPassword;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RefreshTokenRequest {
        @JsonProperty("refresh_token")
        private String refreshToken;
    }
}
