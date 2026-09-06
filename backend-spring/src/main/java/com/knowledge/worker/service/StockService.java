package com.knowledge.worker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.StockDto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class StockService {

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, StockQuote> quoteCache = new ConcurrentHashMap<>();
    private final Map<String, Long> cacheTimestamps = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    public static final Map<String, String> COMPANY_NAMES = Map.ofEntries(
            Map.entry("AAPL", "Apple Inc."),
            Map.entry("MSFT", "Microsoft Corporation"),
            Map.entry("GOOGL", "Alphabet Inc."),
            Map.entry("AMZN", "Amazon.com Inc."),
            Map.entry("TSLA", "Tesla Inc."),
            Map.entry("NVDA", "NVIDIA Corporation"),
            Map.entry("META", "Meta Platforms Inc."),
            Map.entry("NFLX", "Netflix Inc."),
            Map.entry("AMD", "Advanced Micro Devices Inc."),
            Map.entry("INTC", "Intel Corporation"),
            Map.entry("PLTR", "Palantir Technologies Inc."),
            Map.entry("SPY", "SPDR S&P 500 ETF Trust")
    );

    public static final Map<String, Double> BASE_PRICES = Map.ofEntries(
            Map.entry("AAPL", 228.50),
            Map.entry("MSFT", 448.20),
            Map.entry("GOOGL", 182.40),
            Map.entry("AMZN", 186.70),
            Map.entry("TSLA", 215.60),
            Map.entry("NVDA", 128.40),
            Map.entry("META", 512.90),
            Map.entry("NFLX", 685.30),
            Map.entry("AMD", 152.80),
            Map.entry("INTC", 20.40),
            Map.entry("PLTR", 32.10),
            Map.entry("SPY", 562.80)
    );

    public StockQuote getQuote(String symbol) {
        String sym = symbol.trim().toUpperCase();
        long now = System.currentTimeMillis();

        if (quoteCache.containsKey(sym) && (now - cacheTimestamps.getOrDefault(sym, 0L) < CACHE_TTL_MS)) {
            return quoteCache.get(sym);
        }

        // Try Yahoo Finance API
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + sym + "?interval=1d&range=1d";
            Request request = new Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    JsonNode root = objectMapper.readTree(response.body().string());
                    JsonNode meta = root.path("chart").path("result").get(0).path("meta");
                    if (!meta.isMissingNode()) {
                        double price = meta.path("regularMarketPrice").asDouble();
                        double prevClose = meta.path("chartPreviousClose").asDouble(price);
                        double change = price - prevClose;
                        double changePct = prevClose > 0 ? (change / prevClose) * 100.0 : 0.0;
                        double dayHigh = meta.path("regularMarketDayHigh").asDouble(price * 1.01);
                        double dayLow = meta.path("regularMarketDayLow").asDouble(price * 0.99);
                        long volume = meta.path("regularMarketVolume").asLong(15000000);

                        StockQuote quote = StockQuote.builder()
                                .symbol(sym)
                                .name(COMPANY_NAMES.getOrDefault(sym, sym))
                                .price(Math.round(price * 100.0) / 100.0)
                                .change(Math.round(change * 100.0) / 100.0)
                                .changePercent(Math.round(changePct * 100.0) / 100.0)
                                .dayHigh(Math.round(dayHigh * 100.0) / 100.0)
                                .dayLow(Math.round(dayLow * 100.0) / 100.0)
                                .volume(volume)
                                .timestamp(Instant.now().toString())
                                .build();

                        quoteCache.put(sym, quote);
                        cacheTimestamps.put(sym, now);
                        return quote;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Live stock fetch failed for {}: {}", sym, e.getMessage());
        }

        // Fallback to baseline price
        double base = BASE_PRICES.getOrDefault(sym, 150.0);
        StockQuote fallback = StockQuote.builder()
                .symbol(sym)
                .name(COMPANY_NAMES.getOrDefault(sym, sym))
                .price(base)
                .change(1.25)
                .changePercent(0.85)
                .dayHigh(Math.round(base * 1.015 * 100.0) / 100.0)
                .dayLow(Math.round(base * 0.985 * 100.0) / 100.0)
                .volume(25000000L)
                .timestamp(Instant.now().toString())
                .build();

        quoteCache.put(sym, fallback);
        cacheTimestamps.put(sym, now);
        return fallback;
    }

    public List<StockQuote> getMultipleQuotes(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            symbols = List.of("AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX");
        }
        return symbols.stream().map(this::getQuote).toList();
    }

    public StockHistoryResponse getHistory(String symbol, String period) {
        String sym = symbol.trim().toUpperCase();
        StockQuote current = getQuote(sym);
        double currentPrice = current.getPrice();

        List<HistoryPoint> points = new ArrayList<>();
        int days = "1y".equalsIgnoreCase(period) ? 365 : ("1m".equalsIgnoreCase(period) ? 30 : 7);

        Random random = new Random(sym.hashCode());
        LocalDate today = LocalDate.now();

        double simPrice = currentPrice * (1.0 - (days * 0.001));
        for (int i = days; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            double dailyDelta = (random.nextDouble() - 0.48) * (currentPrice * 0.02);
            simPrice = Math.max(10.0, simPrice + dailyDelta);
            points.add(HistoryPoint.builder()
                    .date(date.toString())
                    .open(Math.round(simPrice * 100.0) / 100.0)
                    .high(Math.round(simPrice * 1.01 * 100.0) / 100.0)
                    .low(Math.round(simPrice * 0.99 * 100.0) / 100.0)
                    .close(Math.round(simPrice * 100.0) / 100.0)
                    .volume((long) (10000000 + random.nextInt(20000000)))
                    .build());
        }

        return StockHistoryResponse.builder()
                .symbol(sym)
                .period(period)
                .history(points)
                .build();
    }
}
