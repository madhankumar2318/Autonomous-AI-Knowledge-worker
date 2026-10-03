package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

public class SearchDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SearchResultItem {
        private String title;
        private String link;
        private String snippet;
        private String source;
        /** true = fresh news article from RSS */
        private Boolean fresh;
        /** true = YouTube video result */
        @JsonProperty("is_video")
        private Boolean isVideo;
        /** Video thumbnail URL (YouTube mqdefault.jpg) */
        private String thumbnail;
        /** YouTube video ID for embed */
        @JsonProperty("video_id")
        private String videoId;
        /** YouTube channel name */
        private String channel;
        /** YouTube view count string */
        private String views;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SearchResponse {
        private String query;
        private int page;
        private int total;
        private List<SearchResultItem> results;
        /** Engines that contributed results, e.g. ["google_news_rss","youtube","duckduckgo_web"] */
        private List<String> engines;
        private String error;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SuggestionsResponse {
        private String query;
        private List<String> suggestions;
        private List<String> trending;
    }
}
