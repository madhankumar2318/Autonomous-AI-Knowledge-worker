package com.knowledge.worker.controller;

import com.knowledge.worker.dto.ThreadDtos.*;
import com.knowledge.worker.service.ChatThreadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/chat/threads", "/chat/threads/"})
@RequiredArgsConstructor
public class ChatThreadController {

    private final ChatThreadService threadService;

    @GetMapping
    public ResponseEntity<List<ThreadResponse>> listThreads(@RequestParam(defaultValue = "guest") String username) {
        return ResponseEntity.ok(threadService.listThreads(username));
    }

    @PostMapping
    public ResponseEntity<ThreadResponse> createThread(@RequestBody ThreadCreateRequest req) {
        return ResponseEntity.ok(threadService.createThread(req));
    }

    @GetMapping("/{threadId}/messages")
    public ResponseEntity<List<MessageResponse>> getThreadMessages(@PathVariable String threadId) {
        return ResponseEntity.ok(threadService.getThreadMessages(threadId));
    }

    @PatchMapping("/{threadId}")
    public ResponseEntity<ThreadResponse> renameThread(@PathVariable String threadId, @RequestBody ThreadRenameRequest req) {
        return ResponseEntity.ok(threadService.renameThread(threadId, req.getTitle()));
    }

    @DeleteMapping("/{threadId}")
    public ResponseEntity<Map<String, String>> deleteThread(@PathVariable String threadId) {
        threadService.deleteThread(threadId);
        return ResponseEntity.ok(Map.of("status", "deleted", "id", threadId));
    }
}
