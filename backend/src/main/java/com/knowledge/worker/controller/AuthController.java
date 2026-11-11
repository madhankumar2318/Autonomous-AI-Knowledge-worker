package com.knowledge.worker.controller;

import com.knowledge.worker.dto.AuthDtos.*;
import com.knowledge.worker.service.AuthService;
import com.knowledge.worker.service.RateLimitingService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.knowledge.worker.service.AuditService;
import java.util.Map;

@RestController
@RequestMapping({"/auth", "/auth/"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RateLimitingService rateLimitingService;
    private final AuditService auditService;

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) {
            return xri.trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @RequestBody(required = false) RegisterRequest bodyReq,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String password,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) String avatar
    ) {
        RegisterRequest req = bodyReq;
        if (req == null || req.getUsername() == null) {
            req = RegisterRequest.builder()
                    .username(username)
                    .password(password)
                    .name(name)
                    .email(email)
                    .mobile(mobile)
                    .build();
        }
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @RequestBody(required = false) LoginRequest bodyReq,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String password,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String clientIp = getClientIp(request);
        rateLimitingService.checkLoginRateLimit(clientIp);

        LoginRequest req = bodyReq;
        if (req == null || req.getUsername() == null) {
            req = LoginRequest.builder()
                    .username(username)
                    .password(password)
                    .build();
        }
        try {
            AuthResponse res = authService.login(req, response, clientIp, request);
            auditService.recordEvent("AUTH_LOGIN_SUCCESS", req.getUsername(), clientIp, "/auth/login", "SUCCESS", "User authenticated successfully");
            return ResponseEntity.ok(res);
        } catch (ResponseStatusException rse) {
            // Already logged detailed audit event in authService if user exists
            if (rse.getReason() != null && rse.getReason().contains("Invalid username or password") && !rse.getReason().contains("remaining")) {
                auditService.recordEvent("AUTH_LOGIN_FAILURE", req.getUsername(), clientIp, "/auth/login", "FAILURE", "Unknown user or authentication failed");
            }
            throw rse;
        } catch (Exception e) {
            auditService.recordEvent("AUTH_LOGIN_FAILURE", req.getUsername(), clientIp, "/auth/login", "FAILURE", e.getMessage());
            throw e;
        }
    }

    @PostMapping("/unlock/{username}")
    public ResponseEntity<Map<String, String>> unlockAccount(
            @PathVariable String username,
            Authentication authentication,
            HttpServletRequest request
    ) {
        String adminName = authentication != null ? authentication.getName() : null;
        if (adminName == null || !"admin".equalsIgnoreCase(adminName)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrative privileges required.");
        }
        String clientIp = getClientIp(request);
        authService.unlockAccount(username, adminName, clientIp);
        return ResponseEntity.ok(Map.of("message", "User account '" + username + "' has been unlocked successfully."));
    }

    @GetMapping("/verify")
    public ResponseEntity<VerifyResponse> verify(Authentication authentication, HttpServletRequest request) {
        String username = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(authService.verify(username, request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody(required = false) RefreshTokenRequest req,
                                                HttpServletRequest request,
                                                HttpServletResponse response) {
        String tokenStr = req != null ? req.getRefreshToken() : null;
        if (tokenStr == null && request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if ("refresh_token".equals(c.getName())) {
                    tokenStr = c.getValue();
                    break;
                }
            }
        }
        return ResponseEntity.ok(authService.refresh(tokenStr, response));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(Authentication authentication,
                                                     HttpServletRequest request,
                                                     HttpServletResponse response) {
        String username = authentication != null ? authentication.getName() : null;
        String clientIp = getClientIp(request);
        authService.logout(username, request, response);
        auditService.recordEvent("AUTH_LOGOUT", username, clientIp, "/auth/logout", "SUCCESS", "User logged out");
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/profile")
    public ResponseEntity<UserDto> getProfile(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "guest";
        return ResponseEntity.ok(authService.getProfile(username));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDto> updateProfile(
            Authentication authentication,
            @RequestBody(required = false) ProfileUpdateRequest bodyReq,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) String avatar
    ) {
        String username = authentication != null ? authentication.getName() : "guest";
        ProfileUpdateRequest req = bodyReq;
        if (req == null) {
            req = ProfileUpdateRequest.builder().name(name).email(email).mobile(mobile).avatar(avatar).build();
        } else {
            if (req.getName() == null && name != null) req.setName(name);
            if (req.getEmail() == null && email != null) req.setEmail(email);
            if (req.getMobile() == null && mobile != null) req.setMobile(mobile);
            if (req.getAvatar() == null && avatar != null) req.setAvatar(avatar);
        }
        return ResponseEntity.ok(authService.updateProfile(username, req));
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(
            Authentication authentication,
            @RequestBody(required = false) PasswordChangeRequest bodyReq,
            @RequestParam(required = false, name = "current_password") String currentPasswordParam,
            @RequestParam(required = false, name = "old_password") String oldPasswordParam,
            @RequestParam(required = false, name = "new_password") String newPasswordParam
    ) {
        String username = authentication != null ? authentication.getName() : "guest";
        PasswordChangeRequest req = bodyReq;
        if (req == null) {
            String currPass = currentPasswordParam != null ? currentPasswordParam : oldPasswordParam;
            req = new PasswordChangeRequest(currPass, newPasswordParam);
        } else if (req.getCurrentPassword() == null) {
            String currPass = currentPasswordParam != null ? currentPasswordParam : oldPasswordParam;
            req.setCurrentPassword(currPass);
        }
        authService.changePassword(username, req);
        auditService.recordEvent("AUTH_PASSWORD_CHANGE", username, "authenticated", "/auth/password", "SUCCESS", "User changed password");
        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }

    @DeleteMapping("/profile")
    public ResponseEntity<Map<String, String>> deleteAccount(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "guest";
        authService.deleteAccount(username);
        auditService.recordEvent("AUTH_ACCOUNT_DELETE", username, "authenticated", "/auth/profile", "SUCCESS", "User deleted their account");
        return ResponseEntity.ok(Map.of("message", "Account deleted successfully"));
    }
    @GetMapping("/devices")
    public ResponseEntity<Map<String, Object>> getDevices(Authentication authentication, HttpServletRequest request) {
        String username = authentication != null ? authentication.getName() : "guest";
        java.util.List<DeviceSessionDto> sessions = authService.getActiveDevices(username, request);
        return ResponseEntity.ok(Map.of("sessions", sessions));
    }

    @PostMapping("/devices")
    public ResponseEntity<Map<String, Object>> handleDeviceAction(
            Authentication authentication,
            @RequestBody(required = false) DeviceActionRequest body,
            HttpServletRequest request
    ) {
        String username = authentication != null ? authentication.getName() : "guest";
        String action = body != null ? body.getAction() : "";
        if ("logout_others".equalsIgnoreCase(action)) {
            authService.logoutOtherDevices(username, request);
        } else if ("logout_device".equalsIgnoreCase(action) && body != null && body.getSessionId() != null) {
            authService.logoutDevice(username, body.getSessionId());
        }
        java.util.List<DeviceSessionDto> sessions = authService.getActiveDevices(username, request);
        return ResponseEntity.ok(Map.of("message", "Success", "sessions", sessions));
    }

    @PostMapping("/devices/logout-others")
    public ResponseEntity<Map<String, Object>> logoutOthers(Authentication authentication, HttpServletRequest request) {
        String username = authentication != null ? authentication.getName() : "guest";
        authService.logoutOtherDevices(username, request);
        java.util.List<DeviceSessionDto> sessions = authService.getActiveDevices(username, request);
        return ResponseEntity.ok(Map.of("message", "Logged out of other devices successfully", "sessions", sessions));
    }

    @DeleteMapping("/devices/{id}")
    public ResponseEntity<Map<String, String>> deleteDevice(
            Authentication authentication,
            @PathVariable("id") String deviceId
    ) {
        String username = authentication != null ? authentication.getName() : "guest";
        authService.logoutDevice(username, deviceId);
        return ResponseEntity.ok(Map.of("message", "Device disconnected successfully"));
    }
}
