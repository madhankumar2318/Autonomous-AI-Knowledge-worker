package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "chat_threads", indexes = {
    @Index(name = "chat_threads_user_idx", columnList = "username, updated_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatThread {

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Column(nullable = false, length = 255)
    private String username;

    @Column(length = 500)
    @Builder.Default
    private String title = "New Chat";

    @Column(length = 100)
    private String model;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
