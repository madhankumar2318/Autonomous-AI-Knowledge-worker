package com.knowledge.worker.service;

import com.knowledge.worker.dto.AuthDtos.*;
import com.knowledge.worker.entity.RefreshToken;
import com.knowledge.worker.entity.User;
import com.knowledge.worker.entity.UserSetting;
import com.knowledge.worker.repository.RefreshTokenRepository;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.repository.UserSettingRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserSettingRepository userSettingRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already exists");
        }

        User user = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .email(req.getEmail())
                .mobile(req.getMobile())
                .build();

        user = userRepository.save(user);

        // Initialize user settings
        UserSetting setting = UserSetting.builder()
                .userId(user.getId())
                .defaultModel("llama-70b")
                .temperature(0.1f)
                .systemPrompt("")
                .chunkSize(800)
                .chunkOverlap(100)
                .build();
        userSettingRepository.save(setting);

        String accessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));

        return AuthResponse.builder()
                .accessToken(accessToken)
                .tokenType("bearer")
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .message("Registration successful")
                .build();
    }

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletResponse response) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        boolean passwordMatches = false;
        if (user.getPassword() != null && user.getPassword().startsWith("$2")) {
            passwordMatches = passwordEncoder.matches(req.getPassword(), user.getPassword());
        } else if (user.getPassword() != null) {
            passwordMatches = req.getPassword().equals(user.getPassword());
            if (passwordMatches) {
                user.setPassword(passwordEncoder.encode(req.getPassword()));
                userRepository.save(user);
            }
        }

        if (!passwordMatches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        String accessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));
        String refreshTokenStr = jwtService.generateRefreshToken(user.getUsername());
        String familyId = UUID.randomUUID().toString();

        // Save initial family root refresh token in DB
        RefreshToken refreshToken = RefreshToken.builder()
                .username(user.getUsername())
                .token(refreshTokenStr)
                .familyId(familyId)
                .revoked(false)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(refreshToken);

        // Set refresh token cookie with SameSite=None and Secure for cross-origin frontend-backend
        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", refreshTokenStr)
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/")
                .maxAge(7 * 24 * 60 * 60)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());

        // Also set access token cookie with SameSite=None and Secure
        ResponseCookie accessCookie = ResponseCookie.from("access_token", accessToken)
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/")
                .maxAge(24 * 60 * 60)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .tokenType("bearer")
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .message("Login successful")
                .build();
    }

    public VerifyResponse verify(String username) {
        if (username == null || username.isBlank() || "anonymousUser".equals(username)) {
            return VerifyResponse.builder().valid(false).build();
        }

        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return VerifyResponse.builder().valid(false).build();
        }

        User user = userOpt.get();
        return VerifyResponse.builder()
                .valid(true)
                .username(user.getUsername())
                .user(UserDto.builder()
                        .username(user.getUsername())
                        .name(user.getName())
                        .email(user.getEmail())
                        .mobile(user.getMobile())
                        .build())
                .build();
    }

    @Transactional
    public AuthResponse refresh(String refreshTokenStr, HttpServletResponse response) {
        if (refreshTokenStr == null || refreshTokenStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is missing");
        }

        RefreshToken token = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        // 1. REPLAY ATTACK DETECTION:
        // If an already-revoked refresh token is presented, someone is attempting to replay a compromised token.
        // Immediately revoke the entire token family to protect the account.
        if (token.isRevoked()) {
            String compromisedFamily = token.getFamilyId();
            if (compromisedFamily != null && !compromisedFamily.isBlank()) {
                refreshTokenRepository.deleteByFamilyId(compromisedFamily);
            } else {
                refreshTokenRepository.deleteByUsername(token.getUsername());
            }

            auditService.recordEvent(
                    "REFRESH_TOKEN_REUSE_DETECTED",
                    token.getUsername(),
                    null,
                    "/auth/refresh",
                    "BLOCKED",
                    "Attempted reuse of already-revoked refresh token in family " + compromisedFamily + ". Entire family invalidated."
            );

            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Security alert: Refresh token reuse detected. All active sessions have been terminated.");
        }

        // 2. EXPIRATION CHECK
        if (token.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        User user = userRepository.findByUsername(token.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // 3. ROTATION:
        // Mark the current token as revoked and generate a brand-new paired refresh token in the same family.
        String newAccessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));
        String newRefreshTokenStr = jwtService.generateRefreshToken(user.getUsername());

        token.setRevoked(true);
        token.setReplacedByToken(newRefreshTokenStr);
        refreshTokenRepository.save(token);

        RefreshToken newRefreshToken = RefreshToken.builder()
                .username(user.getUsername())
                .token(newRefreshTokenStr)
                .familyId(token.getFamilyId())
                .revoked(false)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(newRefreshToken);

        // 4. Update HTTP-only cookies
        if (response != null) {
            ResponseCookie newRefreshCookie = ResponseCookie.from("refresh_token", newRefreshTokenStr)
                    .httpOnly(true)
                    .secure(true)
                    .sameSite("None")
                    .path("/")
                    .maxAge(7 * 24 * 60 * 60)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, newRefreshCookie.toString());

            ResponseCookie newAccessCookie = ResponseCookie.from("access_token", newAccessToken)
                    .httpOnly(true)
                    .secure(true)
                    .sameSite("None")
                    .path("/")
                    .maxAge(24 * 60 * 60)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, newAccessCookie.toString());
        }

        auditService.recordEvent(
                "AUTH_TOKEN_ROTATED",
                user.getUsername(),
                null,
                "/auth/refresh",
                "SUCCESS",
                "Refresh token rotated successfully for family " + token.getFamilyId()
        );

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshTokenStr)
                .tokenType("bearer")
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .message("Token refreshed and rotated successfully")
                .build();
    }

    @Transactional
    public void logout(String username, HttpServletRequest request, HttpServletResponse response) {
        if (username != null && !username.isBlank()) {
            refreshTokenRepository.deleteByUsername(username);
        }

        // Clear cookies
        ResponseCookie clearRefresh = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, clearRefresh.toString());

        ResponseCookie clearAccess = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(true)
                .sameSite("None")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, clearAccess.toString());
    }

    public UserDto getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return UserDto.builder()
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .build();
    }

    @Transactional
    public UserDto updateProfile(String username, ProfileUpdateRequest req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (req.getName() != null) user.setName(req.getName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getMobile() != null) user.setMobile(req.getMobile());

        userRepository.save(user);

        return UserDto.builder()
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .build();
    }

    @Transactional
    public void changePassword(String username, PasswordChangeRequest req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }
}
