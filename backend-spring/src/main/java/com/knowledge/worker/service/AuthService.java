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
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserSettingRepository userSettingRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

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

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        String accessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));
        String refreshTokenStr = jwtService.generateRefreshToken(user.getUsername());

        // Save refresh token in DB
        RefreshToken refreshToken = RefreshToken.builder()
                .username(user.getUsername())
                .token(refreshTokenStr)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(refreshToken);

        // Set refresh token cookie
        Cookie cookie = new Cookie("refresh_token", refreshTokenStr);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // set true if HTTPS in production
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60);
        response.addCookie(cookie);

        return AuthResponse.builder()
                .accessToken(accessToken)
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

        if (token.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        User user = userRepository.findByUsername(token.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String newAccessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .tokenType("bearer")
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .build();
    }

    @Transactional
    public void logout(String username, HttpServletRequest request, HttpServletResponse response) {
        if (username != null && !username.isBlank()) {
            refreshTokenRepository.deleteByUsername(username);
        }

        // Clear cookie
        Cookie cookie = new Cookie("refresh_token", null);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
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
