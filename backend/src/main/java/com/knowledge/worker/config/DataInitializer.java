package com.knowledge.worker.config;

import com.knowledge.worker.entity.User;
import com.knowledge.worker.entity.UserSetting;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.repository.UserSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@Slf4j
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final UserSettingRepository userSettingRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.initial-password:${ADMIN_INITIAL_PASSWORD:Sk_uyir18}}")
    private String initialAdminPassword;

    @Override
    public void run(String... args) {
        try {
            Optional<User> adminOpt = userRepository.findByUsername("admin");
            if (adminOpt.isEmpty()) {
                String adminPass = (initialAdminPassword != null && !initialAdminPassword.isBlank())
                        ? initialAdminPassword : "Sk_uyir18";
                log.info("Seeding default admin user with initial configured credentials...");
                User admin = User.builder()
                        .username("admin")
                        .password(passwordEncoder.encode(adminPass))
                        .name("Administrator")
                        .email("admin@knowledge-worker.local")
                        .mobile("+1 555-0199")
                        .failedLoginAttempts(0)
                        .accountLocked(false)
                        .lockoutExpiry(null)
                        .build();
                admin = userRepository.save(admin);

                userSettingRepository.save(UserSetting.builder()
                        .userId(admin.getId())
                        .defaultModel("llama-70b")
                        .temperature(0.1f)
                        .chunkSize(800)
                        .chunkOverlap(100)
                        .build());
                log.info("Default admin user created successfully.");
            } else {
                User admin = adminOpt.get();
                // Security: Preserve user's custom password! Do NOT overwrite existing password on restart.
                if (admin.isAccountLocked()) {
                    admin.setAccountLocked(false);
                    admin.setFailedLoginAttempts(0);
                    admin.setLockoutExpiry(null);
                    userRepository.save(admin);
                    log.info("Admin account lockout cleared on server startup.");
                } else {
                    log.info("Admin user verified: account active and credentials preserved.");
                }
            }
        } catch (Exception e) {
            log.error("DataInitializer initialization error: {}", e.getMessage(), e);
        }
    }
}
