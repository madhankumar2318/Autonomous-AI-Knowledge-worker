package com.knowledge.worker.controller;

import com.knowledge.worker.dto.ChatDtos.*;
import com.knowledge.worker.service.AgentService;
import com.knowledge.worker.service.RateLimitingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping({"/chat", "/chat/"})
@RequiredArgsConstructor
public class ChatController {

    private final AgentService agentService;
    private final RateLimitingService rateLimitingService;

    private String resolveUsername(Authentication authentication, String fallback) {
        if (authentication != null && authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        return fallback != null && !fallback.isBlank() ? fallback : "guest";
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest req, Authentication authentication) {
        String username = resolveUsername(authentication, req.getUsername());
        rateLimitingService.checkChatRateLimit(username);
        return ResponseEntity.ok(agentService.processChat(req));
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest req, Authentication authentication) {
        String username = resolveUsername(authentication, req.getUsername());
        rateLimitingService.checkChatRateLimit(username);
        rateLimitingService.acquireStreamLock(username);

        // 3 minute timeout for multi-step autonomous research
        SseEmitter emitter = new SseEmitter(180000L);
        emitter.onCompletion(() -> rateLimitingService.releaseStreamLock(username));
        emitter.onTimeout(() -> rateLimitingService.releaseStreamLock(username));
        emitter.onError((ex) -> rateLimitingService.releaseStreamLock(username));

        agentService.streamChat(req, emitter);
        return emitter;
    }
}
