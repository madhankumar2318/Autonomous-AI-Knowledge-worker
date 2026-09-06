package com.knowledge.worker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.SearchDto.*;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class SearchService {

    @Value("${app.ai.serpapi.api-key:}")
    private String serpApiKey;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public SearchResponse search(String query, int page) {
        String cleanQuery = query != null ? query.trim() : "";
        List<SearchResultItem> items = new ArrayList<>();

        if (!cleanQuery.isEmpty() && serpApiKey != null && serpApiKey.length() > 10) {
            try {
                String url = "https://serpapi.com/search.json?engine=google&q="
                        + URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8)
                        + "&api_key=" + serpApiKey + "&num=10";

                Request req = new Request.Builder().url(url).build();
                try (Response res = httpClient.newCall(req).execute()) {
                    if (res.isSuccessful() && res.body() != null) {
                        JsonNode root = objectMapper.readTree(res.body().string());
                        JsonNode organic = root.path("organic_results");
                        if (organic.isArray()) {
                            for (JsonNode node : organic) {
                                items.add(SearchResultItem.builder()
                                        .title(node.path("title").asText("Search Result"))
                                        .link(node.path("link").asText("#"))
                                        .snippet(node.path("snippet").asText(""))
                                        .build());
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("SerpAPI search failed: {}", e.getMessage());
            }
        }

        // Fallback / standard curated results
        if (items.isEmpty()) {
            items.add(SearchResultItem.builder()
                    .title("Market Overview & Live Intelligence for " + cleanQuery)
                    .link("https://finance.yahoo.com/lookup?s=" + URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8))
                    .snippet("Real-time financial metrics, SEC regulatory filings, and market intelligence for " + cleanQuery + ".")
                    .build());
            items.add(SearchResultItem.builder()
                    .title("Corporate Analysis and Earnings Breakdown: " + cleanQuery)
                    .link("https://www.sec.gov/edgar/searchedgar/companysearch")
                    .snippet("Official financial statements, 10-K, 10-Q disclosures, and strategic corporate filings.")
                    .build());
            items.add(SearchResultItem.builder()
                    .title("Global Tech & Industry Insights on " + cleanQuery)
                    .link("https://news.google.com/search?q=" + URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8))
                    .snippet("Aggregated industry developments, executive interviews, and macroeconomic perspectives.")
                    .build());
        }

        return SearchResponse.builder()
                .query(cleanQuery)
                .page(page)
                .total(items.size())
                .results(items)
                .build();
    }

    public List<String> getSuggestions(String query) {
        if (query == null || query.isBlank()) {
            return List.of("Tesla stock price", "NVIDIA AI earnings", "Federal Reserve interest rates", "Apple quarterly results", "S&P 500 trends");
        }
        String q = query.trim().toLowerCase();
        List<String> pool = List.of(
                "Tesla stock analysis",
                "Tesla vs NVIDIA comparison",
                "NVIDIA GPU datacenter growth",
                "Apple earnings call highlights",
                "Microsoft cloud AI revenue",
                "Google Gemini 2.5 benchmarks",
                "Federal Reserve inflation forecast",
                "Semiconductor industry outlook"
        );
        return pool.stream()
                .filter(s -> s.toLowerCase().contains(q) || q.contains(s.split(" ")[0].toLowerCase()))
                .limit(5)
                .toList();
    }
}
