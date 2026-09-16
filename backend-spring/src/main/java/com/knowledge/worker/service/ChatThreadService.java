package com.knowledge.worker.service;

import com.knowledge.worker.dto.ThreadDtos.*;
import com.knowledge.worker.entity.ChatMessage;
import com.knowledge.worker.entity.ChatThread;
import com.knowledge.worker.repository.ChatMessageRepository;
import com.knowledge.worker.repository.ChatThreadRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatThreadService {

    private final ChatThreadRepository threadRepository;
    private final ChatMessageRepository messageRepository;
    private final XssSanitizerService xssSanitizer;

    public List<ThreadResponse> listThreads(String username) {
        if (username == null || username.isBlank()) {
            username = "guest";
        }
        return threadRepository.findByUsernameOrderByUpdatedAtDesc(username).stream()
                .map(this::toThreadResponse)
                .toList();
    }

    @Transactional
    public ThreadResponse createThread(ThreadCreateRequest req) {
        String id = UUID.randomUUID().toString();
        String username = req.getUsername() != null && !req.getUsername().isBlank() ? req.getUsername() : "guest";
        String rawTitle = req.getTitle() != null && !req.getTitle().isBlank() ? req.getTitle() : "New Chat";
        String title = xssSanitizer.sanitizePlainText(rawTitle, 100);

        ChatThread thread = ChatThread.builder()
                .id(id)
                .username(username)
                .title(title)
                .model(req.getModel())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        thread = threadRepository.save(thread);
        return toThreadResponse(thread);
    }

    private void verifyThreadOwnership(ChatThread thread, String username) {
        if (thread == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found");
        }
        if (username == null || username.isBlank() || "anonymousUser".equals(username)) {
            return;
        }
        if ("admin".equalsIgnoreCase(username)) {
            return;
        }
        if (thread.getUsername() != null && !thread.getUsername().equalsIgnoreCase(username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this thread");
        }
    }

    public List<MessageResponse> getThreadMessages(String threadId, String username) {
        ChatThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        verifyThreadOwnership(thread, username);
        return messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional
    public ThreadResponse renameThread(String threadId, String title, String username) {
        ChatThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        verifyThreadOwnership(thread, username);

        thread.setTitle(xssSanitizer.sanitizePlainText(title, 100));
        thread.setUpdatedAt(Instant.now());
        thread = threadRepository.save(thread);
        return toThreadResponse(thread);
    }

    @Transactional
    public void deleteThread(String threadId, String username) {
        ChatThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        verifyThreadOwnership(thread, username);

        messageRepository.deleteByThreadId(threadId);
        threadRepository.deleteById(threadId);
    }

    @Transactional
    public void saveMessage(String threadId, String role, String content) {
        if (threadId == null || threadId.isBlank() || content == null || content.isBlank()) {
            return;
        }

        // Sanitize before persisting — applies rich-content rules for message bodies
        String safeContent = xssSanitizer.sanitizeRichContent(content, 32000);

        ChatMessage msg = ChatMessage.builder()
                .threadId(threadId)
                .role(role)
                .content(safeContent)
                .createdAt(Instant.now())
                .build();
        messageRepository.save(msg);

        threadRepository.findById(threadId).ifPresent(thread -> {
            thread.setUpdatedAt(Instant.now());
            // Auto title if thread is still "New Chat" and this is a user message
            if ("user".equalsIgnoreCase(role) && "New Chat".equals(thread.getTitle())) {
                String rawAutoTitle = safeContent.length() > 50 ? safeContent.substring(0, 50).trim() + "..." : safeContent.trim();
                thread.setTitle(xssSanitizer.sanitizePlainText(rawAutoTitle, 100));
            }
            threadRepository.save(thread);
        });
    }

    private ThreadResponse toThreadResponse(ChatThread thread) {
        return ThreadResponse.builder()
                .id(thread.getId())
                .username(thread.getUsername())
                .title(thread.getTitle())
                .model(thread.getModel())
                .createdAt(thread.getCreatedAt().toString())
                .updatedAt(thread.getUpdatedAt().toString())
                .build();
    }

    private MessageResponse toMessageResponse(ChatMessage message) {
        return MessageResponse.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .role(message.getRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt().toString())
                .build();
    }
}
