package com.knowledge.worker.controller;

import com.knowledge.worker.dto.ChatDtos.*;
import com.knowledge.worker.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping({"/chat", "/chat/"})
@RequiredArgsConstructor
public class ChatController {

    private final AgentService agentService;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest req) {
        return ResponseEntity.ok(agentService.processChat(req));
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody ChatRequest req) {
        // 3 minute timeout for multi-step autonomous research
        SseEmitter emitter = new SseEmitter(180000L);
        agentService.streamChat(req, emitter);
        return emitter;
    }
}
