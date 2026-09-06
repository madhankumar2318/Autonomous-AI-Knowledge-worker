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

                if (payload.containsKey("default_model")) {
                    setting.setDefaultModel(String.valueOf(payload.get("default_model")));
                }
                if (payload.containsKey("temperature")) {
                    setting.setTemperature(Float.parseFloat(String.valueOf(payload.get("temperature"))));
                }
                if (payload.containsKey("system_prompt")) {
                    setting.setSystemPrompt(String.valueOf(payload.get("system_prompt")));
                }
                if (payload.containsKey("chunk_size")) {
                    setting.setChunkSize(Integer.parseInt(String.valueOf(payload.get("chunk_size"))));
                }
                if (payload.containsKey("chunk_overlap")) {
                    setting.setChunkOverlap(Integer.parseInt(String.valueOf(payload.get("chunk_overlap"))));
                }
                userSettingRepository.save(setting);
            }
        }

        return getSettings(authentication);
    }
}
