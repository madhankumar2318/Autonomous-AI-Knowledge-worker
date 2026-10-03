package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "token_usage")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String username;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "input_tokens")
    @Builder.Default
    private Integer inputTokens = 0;

    @Column(name = "output_tokens")
    @Builder.Default
    private Integer outputTokens = 0;

    @Column(name = "latency_ms")
    @Builder.Default
    private Integer latencyMs = 0;

    @Column(name = "estimated_cost_usd")
    @Builder.Default
    private Double estimatedCostUsd = 0.0;

    @Column(name = "timestamp")
    @Builder.Default
    private Instant timestamp = Instant.now();
}
