package com.knowledge.worker.config;

import com.knowledge.worker.entity.User;
import com.knowledge.worker.entity.UserSetting;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.repository.UserSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    @Override
    public void run(String... args) {
        try {
            Optional<User> adminOpt = userRepository.findByUsername("admin");
            if (adminOpt.isEmpty()) {
                log.info("Seeding default admin user (admin / Sk_uyir18)...");
                User admin = User.builder()
                        .username("admin")
                        .password(passwordEncoder.encode("Sk_uyir18"))
                        .name("Administrator")
                        .email("admin@knowledge-worker.local")
                        .mobile("+1 555-0199")
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
                if (!passwordEncoder.matches("Sk_uyir18", admin.getPassword())) {
                    log.info("Syncing admin user password to Sk_uyir18...");
                    admin.setPassword(passwordEncoder.encode("Sk_uyir18"));
                    userRepository.save(admin);
                }
            }
        } catch (Exception e) {
            log.warn("DataInitializer warning: {}", e.getMessage());
        }
    }
}
