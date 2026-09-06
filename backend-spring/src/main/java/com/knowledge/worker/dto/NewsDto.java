package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

public class NewsDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Article {
        private String title;
        private String description;
        private String url;
        private String source;
        @JsonProperty("published_at")
        private String publishedAt;
        @JsonProperty("url_to_image")
        private String urlToImage;
        private String category;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NewsResponse {
        private List<Article> articles;
        private int page;
        @JsonProperty("total_results")
        private int totalResults;
    }
}
