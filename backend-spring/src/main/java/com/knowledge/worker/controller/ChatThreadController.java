package com.knowledge.worker.controller;

import com.knowledge.worker.dto.ThreadDtos.*;
import com.knowledge.worker.service.ChatThreadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/chat/threads", "/chat/threads/"})
@RequiredArgsConstructor
public class ChatThreadController {

    private final ChatThreadService threadService;

    private String resolveUsername(Authentication authentication, String fallback) {
        if (authentication != null && authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        return fallback != null && !fallback.isBlank() ? fallback : "guest";
    }

    @GetMapping
    public ResponseEntity<List<ThreadResponse>> listThreads(
            @RequestParam(defaultValue = "guest") String username,
            Authentication authentication) {
        return ResponseEntity.ok(threadService.listThreads(resolveUsername(authentication, username)));
    }

    @PostMapping
    public ResponseEntity<ThreadResponse> createThread(
            @RequestBody ThreadCreateRequest req,
            Authentication authentication) {
        if (authentication != null && authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            req.setUsername(authentication.getName());
        }
        return ResponseEntity.ok(threadService.createThread(req));
    }

    @GetMapping("/{threadId}/messages")
    public ResponseEntity<List<MessageResponse>> getThreadMessages(
            @PathVariable String threadId,
            Authentication authentication) {
        String user = resolveUsername(authentication, "guest");
        return ResponseEntity.ok(threadService.getThreadMessages(threadId, user));
    }

    @PatchMapping("/{threadId}")
    public ResponseEntity<ThreadResponse> renameThread(
            @PathVariable String threadId,
            @RequestBody ThreadRenameRequest req,
            Authentication authentication) {
        String user = resolveUsername(authentication, "guest");
        return ResponseEntity.ok(threadService.renameThread(threadId, req.getTitle(), user));
    }

    @DeleteMapping("/{threadId}")
    public ResponseEntity<Map<String, String>> deleteThread(
            @PathVariable String threadId,
            Authentication authentication) {
        String user = resolveUsername(authentication, "guest");
        threadService.deleteThread(threadId, user);
        return ResponseEntity.ok(Map.of("status", "deleted", "id", threadId));
    }
}
