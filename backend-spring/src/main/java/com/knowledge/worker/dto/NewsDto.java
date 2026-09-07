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
        private String category;

        @JsonProperty("published_at")
        private String publishedAt;

        @JsonProperty("url_to_image")
        private String urlToImage;

        @JsonProperty("publishedAt")
        public String getPublishedAtCamel() {
            return publishedAt;
        }

        @JsonProperty("urlToImage")
        public String getUrlToImageCamel() {
            return urlToImage;
        }
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

        @JsonProperty("news")
        public List<Article> getNews() {
            return articles;
        }

        @JsonProperty("total")
        public int getTotal() {
            return totalResults;
        }

        @JsonProperty("has_more")
        public boolean isHasMore() {
            return false;
        }

        @JsonProperty("hasMore")
        public boolean getHasMoreCamel() {
            return false;
        }
    }
}
