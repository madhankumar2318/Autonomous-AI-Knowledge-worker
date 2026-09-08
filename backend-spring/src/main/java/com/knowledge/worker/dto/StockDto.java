package com.knowledge.worker.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;
import java.util.Map;

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
        @JsonProperty("market_cap")
        private Long marketCap;
        private String timestamp;
        /** 7-point sparkline prices for the mini chart on each stock card */
        private List<Double> history;
        private String error;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MultipleStockResponse {
        private List<StockQuote> stocks;
        private Boolean cached;
        private Map<String, List<String>> sectors;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HistoryPoint {
        private String date;
        private Double price;
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
    public static class StockDetails {
        @JsonProperty("day_high")
        private Double dayHigh;
        @JsonProperty("day_low")
        private Double dayLow;
        private Long volume;
        @JsonProperty("market_cap")
        private Long marketCap;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StockHistoryResponse {
        private String symbol;
        private String period;
        private List<HistoryPoint> data;
        private StockDetails details;
        private String error;

        @JsonProperty("history")
        public List<HistoryPoint> getHistory() {
            return data;
        }
    }
}
