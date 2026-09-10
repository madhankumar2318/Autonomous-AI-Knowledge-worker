package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "uploads")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Upload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String filename;

    @Column(columnDefinition = "TEXT")
    private String filepath;

    private Long size;

    @Column(name = "uploaded_at")
    @Builder.Default
    private Instant uploadedAt = Instant.now();

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "extracted_content", columnDefinition = "TEXT")
    private String extractedContent;
}
