package com.knowledge.worker.controller;

import com.knowledge.worker.entity.User;
import com.knowledge.worker.entity.UserSetting;
import com.knowledge.worker.repository.UserRepository;
import com.knowledge.worker.repository.UserSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping({"/settings", "/settings/"})
@RequiredArgsConstructor
public class SettingsController {

    private final UserRepository userRepository;
    private final UserSettingRepository userSettingRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "guest";
        Map<String, Object> resp = new HashMap<>();

        UserSetting setting = null;
        if (!"guest".equals(username)) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null) {
                setting = userSettingRepository.findByUserId(user.getId()).orElse(null);
            }
        }

        resp.put("default_model", setting != null ? setting.getDefaultModel() : "llama-70b");
        resp.put("temperature", setting != null ? setting.getTemperature() : 0.1);
        resp.put("system_prompt", setting != null ? setting.getSystemPrompt() : "");
        resp.put("chunk_size", setting != null ? setting.getChunkSize() : 800);
        resp.put("chunk_overlap", setting != null ? setting.getChunkOverlap() : 100);

        return ResponseEntity.ok(resp);
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateSettings(Authentication authentication,
                                                             @RequestBody Map<String, Object> payload) {
        String username = authentication != null ? authentication.getName() : "guest";
        if (!"guest".equals(username)) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null) {
                UserSetting setting = userSettingRepository.findByUserId(user.getId())
                        .orElse(UserSetting.builder().userId(user.getId()).build());

                if (payload.containsKey("default_model") && payload.get("default_model") != null) {
                    setting.setDefaultModel(String.valueOf(payload.get("default_model")));
                }
                if (payload.containsKey("temperature") && payload.get("temperature") != null) {
                    try {
                        float temp = Float.parseFloat(String.valueOf(payload.get("temperature")));
                        setting.setTemperature(Math.max(0.0f, Math.min(1.0f, temp)));
                    } catch (NumberFormatException ignored) {}
                }
                if (payload.containsKey("system_prompt") && payload.get("system_prompt") != null) {
                    String prompt = String.valueOf(payload.get("system_prompt"));
                    if (prompt.length() > 2000) {
                        prompt = prompt.substring(0, 2000);
                    }
                    setting.setSystemPrompt(prompt);
                }
                if (payload.containsKey("chunk_size") && payload.get("chunk_size") != null) {
                    try {
                        int chunkSize = Integer.parseInt(String.valueOf(payload.get("chunk_size")));
                        setting.setChunkSize(Math.max(100, Math.min(4000, chunkSize)));
                    } catch (NumberFormatException ignored) {}
                }
                if (payload.containsKey("chunk_overlap") && payload.get("chunk_overlap") != null) {
                    try {
                        int chunkOverlap = Integer.parseInt(String.valueOf(payload.get("chunk_overlap")));
                        int maxOverlap = setting.getChunkSize() != null ? Math.max(0, setting.getChunkSize() / 2) : 500;
                        setting.setChunkOverlap(Math.max(0, Math.min(maxOverlap, chunkOverlap)));
                    } catch (NumberFormatException ignored) {}
                }
                userSettingRepository.save(setting);
            }
        }

        return getSettings(authentication);
    }
}
