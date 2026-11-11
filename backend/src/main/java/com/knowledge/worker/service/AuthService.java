package com.knowledge.worker.service;

import com.knowledge.worker.dto.AuthDtos.*;
import com.knowledge.worker.entity.RefreshToken;
import com.knowledge.worker.entity.User;
import com.knowledge.worker.entity.UserSetting;
import com.knowledge.worker.repository.RefreshTokenRepository;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.repository.UserSettingRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_DURATION_MINUTES = 15;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserSettingRepository userSettingRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final XssSanitizerService xssSanitizer;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String username = req.getUsername() != null ? req.getUsername().trim() : "";
        if (username.length() < 3 || username.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must be between 3 and 50 characters");
        }
        if ("admin".equalsIgnoreCase(username) || "administrator".equalsIgnoreCase(username) || "root".equalsIgnoreCase(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is reserved");
        }

        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already exists");
        }

        User user = User.builder()
                .username(username)
                .password(passwordEncoder.encode(req.getPassword()))
                .name(xssSanitizer.sanitizePlainText(req.getName(), 100))
                .email(xssSanitizer.sanitizePlainText(req.getEmail(), 150))
                .mobile(xssSanitizer.sanitizePlainText(req.getMobile(), 30))
                .failedLoginAttempts(0)
                .accountLocked(false)
                .lockoutExpiry(null)
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
    private String parseDeviceType(String ua) {
        if (ua == null) return "Desktop";
        if (ua.matches("(?i).*iPad|tablet|(android(?!.*mobile)).*")) return "Tablet";
        if (ua.matches("(?i).*iPhone|iPod|Android.*Mobile|Mobile|Windows Phone.*")) return "Mobile";
        return "Desktop";
    }

    private String parseOs(String ua) {
        if (ua == null) return "Desktop";
        if (ua.matches("(?i).*iPhone|iPad|iPod.*")) return "iOS";
        if (ua.matches("(?i).*Android.*")) return "Android";
        if (ua.matches("(?i).*Windows.*")) return "Windows";
        if (ua.matches("(?i).*Macintosh|Mac OS X.*")) return "macOS";
        if (ua.matches("(?i).*Linux.*")) return "Linux";
        return "Desktop";
    }

    private String parseBrowser(String ua) {
        if (ua == null) return "Browser";
        if (ua.matches("(?i).*Edg/.*")) return "Edge";
        if (ua.matches("(?i).*Chrome/.*") && !ua.matches("(?i).*Edg/.*")) {
            return ua.matches("(?i).*Mobile.*") ? "Chrome Mobile" : "Chrome";
        }
        if (ua.matches("(?i).*Safari/.*") && !ua.matches("(?i).*Chrome/.*")) {
            return ua.matches("(?i).*Mobile.*") ? "Mobile Safari" : "Safari";
        }
        if (ua.matches("(?i).*Firefox/.*")) return "Firefox";
        if (ua.matches("(?i).*Opera|OPR/.*")) return "Opera";
        return "Browser";
    }

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletResponse response, String clientIp, HttpServletRequest request) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        // 1. Check if account is locked
        if (user.isAccountLocked()) {
            if (user.getLockoutExpiry() != null && user.getLockoutExpiry().isAfter(Instant.now())) {
                long remainingSeconds = ChronoUnit.SECONDS.between(Instant.now(), user.getLockoutExpiry());
                long remainingMinutes = Math.max(1, (remainingSeconds + 59) / 60);

                auditService.recordEvent(
                        "AUTH_ACCOUNT_LOCKED_ATTEMPT",
                        user.getUsername(),
                        clientIp,
                        "/auth/login",
                        "BLOCKED",
                        "Login attempt on locked account. Lockout active for another " + remainingMinutes + " minute(s)."
                );

                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Account is temporarily locked due to multiple failed login attempts. Please try again after " + remainingMinutes + " minute(s).");
            } else {
                // Auto-unlock: lockout duration has expired
                user.setAccountLocked(false);
                user.setLockoutExpiry(null);
                user.setFailedLoginAttempts(0);
                userRepository.save(user);

                auditService.recordEvent(
                        "AUTH_ACCOUNT_AUTO_UNLOCKED",
                        user.getUsername(),
                        clientIp,
                        "/auth/login",
                        "SUCCESS",
                        "Account lockout duration expired. Account automatically unlocked."
                );
            }
        }

        // 2. Validate Password
        boolean passwordMatches = false;
        if (user.getPassword() != null && user.getPassword().startsWith("$2")) {
            passwordMatches = passwordEncoder.matches(req.getPassword(), user.getPassword());
        } else if (user.getPassword() != null) {
            passwordMatches = req.getPassword().equals(user.getPassword());
            if (passwordMatches) {
                user.setPassword(passwordEncoder.encode(req.getPassword()));
            }
        }

        if (!passwordMatches) {
            int currentFailures = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(currentFailures);

            if (currentFailures >= MAX_FAILED_ATTEMPTS) {
                user.setAccountLocked(true);
                Instant expiry = Instant.now().plus(LOCKOUT_DURATION_MINUTES, ChronoUnit.MINUTES);
                user.setLockoutExpiry(expiry);
                userRepository.save(user);

                auditService.recordEvent(
                        "AUTH_ACCOUNT_LOCKED",
                        user.getUsername(),
                        clientIp,
                        "/auth/login",
                        "LOCKED",
                        "Account locked for " + LOCKOUT_DURATION_MINUTES + " minutes after " + currentFailures + " consecutive failed attempts."
                );

                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Account has been locked for 15 minutes due to 5 consecutive failed login attempts.");
            } else {
                userRepository.save(user);
                int remainingAttempts = MAX_FAILED_ATTEMPTS - currentFailures;
                auditService.recordEvent(
                        "AUTH_LOGIN_FAILURE",
                        user.getUsername(),
                        clientIp,
                        "/auth/login",
                        "FAILURE",
                        "Invalid password. Attempt " + currentFailures + " of " + MAX_FAILED_ATTEMPTS + " before account lockout."
                );

                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Invalid username or password. " + remainingAttempts + " attempt(s) remaining before account lockout.");
            }
        }

        // 3. Login successful: reset failed login attempts & locks if present
        if (user.getFailedLoginAttempts() > 0 || user.isAccountLocked() || user.getLockoutExpiry() != null) {
            user.setFailedLoginAttempts(0);
            user.setAccountLocked(false);
            user.setLockoutExpiry(null);
            userRepository.save(user);
        }

        String accessToken = jwtService.generateAccessToken(user.getUsername(), Map.of("name", user.getName() != null ? user.getName() : ""));
        String refreshTokenStr = jwtService.generateRefreshToken(user.getUsername());

        String ua = request != null ? request.getHeader("User-Agent") : "";
        String hintType = request != null ? request.getHeader("X-Device-Type") : null;
        String hintOs = request != null ? request.getHeader("X-Device-Os") : null;
        String hintBrowser = request != null ? request.getHeader("X-Device-Browser") : null;
        String clientSid = request != null ? request.getHeader("X-Session-Id") : null;

        String deviceType = parseDeviceType(ua);
        if ("Mobile".equalsIgnoreCase(hintType) || "Tablet".equalsIgnoreCase(hintType) || "Desktop".equalsIgnoreCase(hintType)) {
            deviceType = hintType;
        }
        String os = parseOs(ua);
        if (hintOs != null && !hintOs.isBlank()) os = hintOs;
        String browser = parseBrowser(ua);
        if (hintBrowser != null && !hintBrowser.isBlank()) browser = hintBrowser;

        String familyId = (clientSid != null && !clientSid.isBlank()) ? clientSid : "sess_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);

        // Save initial family root refresh token in DB with complete device information
        RefreshToken refreshToken = RefreshToken.builder()
                .username(user.getUsername())
                .token(refreshTokenStr)
                .familyId(familyId)
                .deviceType(deviceType)
                .os(os)
                .browser(browser)
                .ipAddress(clientIp != null && !clientIp.isBlank() ? clientIp : "127.0.0.1")
                .userAgent(ua)
                .lastActiveAt(Instant.now())
                .createdAt(Instant.now())
                .revoked(false)
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
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
                .avatar(user.getAvatar())
                .defaultStartingTab(user.getDefaultStartingScreen())
                .timeFormat(user.getTimeFormat())
                .dateFormat(user.getDateFormat())
                .soundEffects(user.getSoundEffects())
                .sessionId(familyId)
                .message("Login successful")
                .build();
    }

    @Transactional
    public void unlockAccount(String targetUsername, String adminUsername, String clientIp) {
        User user = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User '" + targetUsername + "' not found"));

        user.setAccountLocked(false);
        user.setLockoutExpiry(null);
        user.setFailedLoginAttempts(0);
        userRepository.save(user);

        auditService.recordEvent(
                "AUTH_ACCOUNT_ADMIN_UNLOCKED",
                targetUsername,
                clientIp,
                "/auth/unlock/" + targetUsername,
                "SUCCESS",
                "Account manually unlocked by admin '" + adminUsername + "'"
        );
    }

    public VerifyResponse verify(String username, HttpServletRequest request) {
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
                        .avatar(user.getAvatar())
                        .defaultStartingTab(user.getDefaultStartingScreen())
                        .timeFormat(user.getTimeFormat())
                        .dateFormat(user.getDateFormat())
                        .soundEffects(user.getSoundEffects())
                        .build())
                .build();
    }

    public VerifyResponse verify(String username) {
        return verify(username, null);
    }

    @Transactional
    public AuthResponse refresh(String refreshTokenStr, HttpServletResponse response) {
        if (refreshTokenStr == null || refreshTokenStr.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is missing");
        }

        RefreshToken token = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        // 1. REPLAY ATTACK DETECTION:
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
                .avatar(user.getAvatar())
                .defaultStartingTab(user.getDefaultStartingScreen())
                .timeFormat(user.getTimeFormat())
                .dateFormat(user.getDateFormat())
                .soundEffects(user.getSoundEffects())
                .build();
    }

    @Transactional
    public UserDto updateProfile(String username, ProfileUpdateRequest req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(xssSanitizer.sanitizePlainText(req.getName(), 100));
        }
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            user.setEmail(xssSanitizer.sanitizePlainText(req.getEmail(), 150));
        }
        if (req.getMobile() != null) {
            user.setMobile(xssSanitizer.sanitizePlainText(req.getMobile(), 30));
        }
        if (req.getAvatar() != null) {
            if ("__REMOVE__".equals(req.getAvatar()) || req.getAvatar().isBlank()) {
                user.setAvatar(null);
            } else {
                user.setAvatar(req.getAvatar().trim());
            }
        }
        if (req.getDefaultStartingTab() != null && !req.getDefaultStartingTab().isBlank()) {
            user.setDefaultStartingScreen(req.getDefaultStartingTab().trim());
        }
        if (req.getTimeFormat() != null && !req.getTimeFormat().isBlank()) {
            user.setTimeFormat(req.getTimeFormat().trim());
        }
        if (req.getDateFormat() != null && !req.getDateFormat().isBlank()) {
            user.setDateFormat(req.getDateFormat().trim());
        }
        if (req.getSoundEffects() != null) {
            user.setSoundEffects(req.getSoundEffects());
        }

        userRepository.save(user);

        return UserDto.builder()
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .mobile(user.getMobile())
                .avatar(user.getAvatar())
                .defaultStartingTab(user.getDefaultStartingScreen())
                .timeFormat(user.getTimeFormat())
                .dateFormat(user.getDateFormat())
                .soundEffects(user.getSoundEffects())
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
        user.setFailedLoginAttempts(0);
        user.setAccountLocked(false);
        user.setLockoutExpiry(null);
        userRepository.save(user);

        // Invalidate all previously issued refresh tokens for this user across all sessions
        refreshTokenRepository.deleteByUsername(username);
    }

    @Transactional
    public void deleteAccount(String username) {
        refreshTokenRepository.deleteByUsername(username);
        userRepository.findByUsername(username).ifPresent(userRepository::delete);
    }

    public java.util.List<DeviceSessionDto> getActiveDevices(String username, HttpServletRequest request) {
        java.util.List<RefreshToken> tokens = refreshTokenRepository.findByUsername(username);
        Instant now = Instant.now();
        String currentFamilyId = request != null ? request.getHeader("X-Session-Id") : null;
        String currentUa = request != null ? request.getHeader("User-Agent") : "";
        String hintType = request != null ? request.getHeader("X-Device-Type") : null;
        String hintOs = request != null ? request.getHeader("X-Device-Os") : null;
        String hintBrowser = request != null ? request.getHeader("X-Device-Browser") : null;

        String curDevType = parseDeviceType(currentUa);
        if ("Mobile".equalsIgnoreCase(hintType) || "Tablet".equalsIgnoreCase(hintType) || "Desktop".equalsIgnoreCase(hintType)) {
            curDevType = hintType;
        }
        String curOs = parseOs(currentUa);
        if (hintOs != null && !hintOs.isBlank()) curOs = hintOs;
        String curBrowser = parseBrowser(currentUa);
        if (hintBrowser != null && !hintBrowser.isBlank()) curBrowser = hintBrowser;

        String currentKey = curDevType + "-" + curOs;
        String currentIp = "127.0.0.1";
        if (request != null) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) currentIp = xff.split(",")[0].trim();
            else if (request.getHeader("X-Real-IP") != null) currentIp = request.getHeader("X-Real-IP").trim();
            else if (request.getRemoteAddr() != null) currentIp = request.getRemoteAddr();
        }

        String effectiveCurrentId = (currentFamilyId != null && !currentFamilyId.isBlank()) ? currentFamilyId : "curr_" + System.currentTimeMillis();

        java.util.Map<String, DeviceSessionDto> deviceMap = new java.util.LinkedHashMap<>();

        // 1. Current requesting device ALWAYS has isCurrent = true
        deviceMap.put(currentKey, DeviceSessionDto.builder()
                .id(effectiveCurrentId)
                .deviceType(curDevType)
                .os(curOs)
                .browser(curBrowser)
                .ip(currentIp)
                .lastActiveAt(System.currentTimeMillis())
                .createdAt(System.currentTimeMillis())
                .isCurrent(true)
                .build());

        // 2. Add other distinct physical devices (sorted newest first)
        tokens.sort((a, b) -> {
            Instant tA = a.getLastActiveAt() != null ? a.getLastActiveAt() : a.getCreatedAt();
            Instant tB = b.getLastActiveAt() != null ? b.getLastActiveAt() : b.getCreatedAt();
            return tB.compareTo(tA);
        });

        for (RefreshToken t : tokens) {
            if (t.isRevoked() || (t.getExpiresAt() != null && t.getExpiresAt().isBefore(now))) {
                continue;
            }
            // Skip ghost/unparsed records
            if ((t.getOs() == null || "Desktop".equals(t.getOs())) && (t.getBrowser() == null || "Browser".equals(t.getBrowser())) && (t.getIpAddress() == null || "unknown".equals(t.getIpAddress()))) {
                continue;
            }
            if (t.getIpAddress() == null || "unknown".equals(t.getIpAddress())) {
                continue;
            }

            String dType = t.getDeviceType() != null ? t.getDeviceType() : parseDeviceType(t.getUserAgent());
            String dOs = t.getOs() != null ? t.getOs() : parseOs(t.getUserAgent());
            String dBrowser = t.getBrowser() != null ? t.getBrowser() : parseBrowser(t.getUserAgent());
            String key = dType + "-" + dOs;

            // If same device as current, update current device's ID if needed and skip
            if (key.equals(currentKey)) {
                if (t.getFamilyId() != null && !t.getFamilyId().isBlank()) {
                    deviceMap.get(currentKey).setId(t.getFamilyId());
                }
                continue;
            }

            if (deviceMap.containsKey(key)) {
                continue; // Deduplicate strictly by physical device (deviceType + OS)
            }

            deviceMap.put(key, DeviceSessionDto.builder()
                    .id(t.getFamilyId() != null ? t.getFamilyId() : String.valueOf(t.getId()))
                    .deviceType(dType)
                    .os(dOs)
                    .browser(dBrowser)
                    .ip(t.getIpAddress() != null && !t.getIpAddress().isBlank() ? t.getIpAddress() : "127.0.0.1")
                    .lastActiveAt(t.getLastActiveAt() != null ? t.getLastActiveAt().toEpochMilli() : System.currentTimeMillis())
                    .createdAt(t.getCreatedAt() != null ? t.getCreatedAt().toEpochMilli() : System.currentTimeMillis())
                    .isCurrent(false)
                    .build());
        }

        return new java.util.ArrayList<>(deviceMap.values());
    }

    @Transactional
    public void logoutOtherDevices(String username, HttpServletRequest request) {
        String currentFamilyId = request != null ? request.getHeader("X-Session-Id") : null;
        java.util.List<RefreshToken> tokens = refreshTokenRepository.findByUsername(username);
        for (RefreshToken t : tokens) {
            if (currentFamilyId != null && !currentFamilyId.isBlank() && currentFamilyId.equals(t.getFamilyId())) {
                continue;
            }
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        }
        if (currentFamilyId != null && !currentFamilyId.isBlank()) {
            refreshTokenRepository.deleteByUsernameAndFamilyIdNot(username, currentFamilyId);
        }
    }

    @Transactional
    public void logoutDevice(String username, String familyIdOrId) {
        if (familyIdOrId == null || familyIdOrId.isBlank()) return;
        java.util.List<RefreshToken> tokens = refreshTokenRepository.findByUsername(username);
        for (RefreshToken t : tokens) {
            if (familyIdOrId.equals(t.getFamilyId()) || familyIdOrId.equals(String.valueOf(t.getId())) || familyIdOrId.equals(t.getToken())) {
                t.setRevoked(true);
                refreshTokenRepository.save(t);
            }
        }
        refreshTokenRepository.deleteByFamilyId(familyIdOrId);
        try {
            Long numId = Long.parseLong(familyIdOrId);
            refreshTokenRepository.deleteByIdAndUsername(numId, username);
        } catch (NumberFormatException ignored) {}
    }
}
