package com.knowledge.worker.dto;

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
    }
}
