package com.knowledge.worker.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        // Allow H2 console to render in iframe (same origin only)
                        .frameOptions(frame -> frame.sameOrigin())

                        // Prevent browsers from MIME-sniffing a response away from the declared Content-Type
                        .contentTypeOptions(contentType -> {})

                        // Modern XSS protection: disable legacy header (CSP is the proper defense now)
                        .xssProtection(xss -> xss.disable())

                        // Content Security Policy — tuned for Next.js + SSE + external fonts
                        // - unsafe-inline needed for Tailwind / styled-components
                        // - connect-src allows SSE streaming and API calls from the frontend
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; " +
                                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                                "font-src 'self' https://fonts.gstatic.com data:; " +
                                "img-src 'self' data: https: blob:; " +
                                "connect-src 'self' http: https: ws: wss:; " +
                                "frame-ancestors 'self'; " +
                                "object-src 'none'; " +
                                "base-uri 'self';"
                        ))

                        // Referrer-Policy: only send origin on cross-origin requests (no full path leakage)
                        .referrerPolicy(referrer -> referrer
                                .policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))

                        // Permissions-Policy: disable sensitive browser APIs not used by this app
                        .permissionsPolicy(permissions -> permissions
                                .policy("camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"))
                )
                .authorizeHttpRequests(auth -> auth
                        // CORS pre-flight requests
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Health check & System info
                        .requestMatchers("/", "/db/status").permitAll()

                        // Public Auth entrypoints (Note: verify needs to be accessible so missing sessions return valid:false gracefully)
                        .requestMatchers("/auth/login", "/auth/register", "/auth/refresh", "/auth/verify").permitAll()

                        // Public Market feeds & News
                        .requestMatchers("/news/**", "/stock/**", "/search/**").permitAll()

                        // Dev tools & API docs
                        .requestMatchers("/h2-console/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                        // Protected Workspace & User Resources
                        .requestMatchers("/auth/profile", "/auth/password", "/auth/logout", "/auth/unlock/**").authenticated()
                        .requestMatchers("/upload/**").authenticated()
                        .requestMatchers("/chat/**").authenticated()
                        .requestMatchers("/settings/**").authenticated()
                        .requestMatchers("/audit/**").authenticated()

                        // All other endpoints require authentication by default
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
