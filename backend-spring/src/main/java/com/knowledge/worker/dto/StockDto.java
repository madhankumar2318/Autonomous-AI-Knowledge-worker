package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

public class StockDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StockQuote {
        private String symbol;
        private String name;
        private Double price;
        private Double change;
        @JsonProperty("change_percent")
        private Double changePercent;
        @JsonProperty("day_high")
        private Double dayHigh;
        @JsonProperty("day_low")
        private Double dayLow;
        private Long volume;
        private String timestamp;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HistoryPoint {
        private String date;
        private Double open;
        private Double high;
        private Double low;
        private Double close;
        private Long volume;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StockHistoryResponse {
        private String symbol;
        private String period;
        private List<HistoryPoint> history;
    }
}
