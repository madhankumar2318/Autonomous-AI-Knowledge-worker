package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

public class ChatDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatMessageDto {
        private String role;
        private String content;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatRequest {
        private String message;
        @Builder.Default
        private String username = "guest";
        @Builder.Default
        private List<ChatMessageDto> history = new ArrayList<>();
        private String filename;
        private String model;
        @JsonProperty("thread_id")
        private String threadId;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatResponse {
        private String reply;
        private String model;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ResearchStep {
        private String id;
        private String title;
        private String status; // "pending", "in_progress", "completed"
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ResearchPlan {
        private String title;
        private List<ResearchStep> steps;
    }
}
