package com.knowledge.worker.controller;

import com.knowledge.worker.dto.AuthDtos.*;
import com.knowledge.worker.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping({"/auth", "/auth/"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req, HttpServletResponse response) {
        return ResponseEntity.ok(authService.login(req, response));
    }

    @GetMapping("/verify")
    public ResponseEntity<VerifyResponse> verify(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(authService.verify(username));
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
        authService.logout(username, request, response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/profile")
    public ResponseEntity<UserDto> getProfile(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "guest";
        return ResponseEntity.ok(authService.getProfile(username));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDto> updateProfile(Authentication authentication,
                                                @RequestBody ProfileUpdateRequest req) {
        String username = authentication != null ? authentication.getName() : "guest";
        return ResponseEntity.ok(authService.updateProfile(username, req));
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(Authentication authentication,
                                                              @RequestBody PasswordChangeRequest req) {
        String username = authentication != null ? authentication.getName() : "guest";
        authService.changePassword(username, req);
        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }
}
