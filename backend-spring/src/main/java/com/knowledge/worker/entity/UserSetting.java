package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSetting {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "default_model", length = 100)
    @Builder.Default
    private String defaultModel = "llama-70b";

    @Column(name = "temperature")
    @Builder.Default
    private Float temperature = 0.1f;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    @Builder.Default
    private String systemPrompt = "";

    @Column(name = "chunk_size")
    @Builder.Default
    private Integer chunkSize = 800;

    @Column(name = "chunk_overlap")
    @Builder.Default
    private Integer chunkOverlap = 100;
}
