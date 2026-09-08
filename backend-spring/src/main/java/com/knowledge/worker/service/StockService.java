package com.knowledge.worker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.StockDto.*;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class StockService {

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, StockQuote> quoteCache = new ConcurrentHashMap<>();
    private final Map<String, Long> cacheTimestamps = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    // ─── Sector Map (matching the original Python backend) ───────────────────
    public static final Map<String, List<String>> SECTORS = new LinkedHashMap<>();
    static {
        SECTORS.put("Technology",    List.of("AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMD", "INTC", "CRM", "ORCL", "ADBE", "QCOM", "TXN"));
        SECTORS.put("Consumer Tech", List.of("AMZN", "TSLA", "NFLX", "UBER", "ABNB", "SNAP", "PINS"));
        SECTORS.put("Finance",       List.of("JPM", "BAC", "GS", "MS", "V", "MA", "WFC", "AXP", "BLK"));
        SECTORS.put("Healthcare",    List.of("JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT"));
        SECTORS.put("Energy",        List.of("XOM", "CVX", "COP", "SLB", "PSX"));
        SECTORS.put("Consumer",      List.of("WMT", "HD", "MCD", "SBUX", "NKE", "COST", "TGT"));
        SECTORS.put("Industrial",    List.of("BA", "CAT", "HON", "UPS", "GE"));
        SECTORS.put("ETFs",          List.of("SPY", "QQQ", "DIA", "IWM", "VTI"));
    }

    public static final List<String> ALL_SYMBOLS = SECTORS.values().stream()
            .flatMap(List::stream).toList();

    public static final Map<String, String> COMPANY_NAMES = Map.ofEntries(
            Map.entry("AAPL", "Apple Inc."), Map.entry("MSFT", "Microsoft Corp."),
            Map.entry("NVDA", "NVIDIA Corp."), Map.entry("GOOGL", "Alphabet Inc."),
            Map.entry("META", "Meta Platforms"), Map.entry("AMD", "Advanced Micro Devices"),
            Map.entry("INTC", "Intel Corp."), Map.entry("CRM", "Salesforce Inc."),
            Map.entry("ORCL", "Oracle Corp."), Map.entry("ADBE", "Adobe Inc."),
            Map.entry("QCOM", "Qualcomm Inc."), Map.entry("TXN", "Texas Instruments"),
            Map.entry("AMZN", "Amazon.com Inc."), Map.entry("TSLA", "Tesla Inc."),
            Map.entry("NFLX", "Netflix Inc."), Map.entry("UBER", "Uber Technologies"),
            Map.entry("ABNB", "Airbnb Inc."), Map.entry("SNAP", "Snap Inc."),
            Map.entry("PINS", "Pinterest Inc."), Map.entry("JPM", "JPMorgan Chase"),
            Map.entry("BAC", "Bank of America"), Map.entry("GS", "Goldman Sachs"),
            Map.entry("MS", "Morgan Stanley"), Map.entry("V", "Visa Inc."),
            Map.entry("MA", "Mastercard Inc."), Map.entry("WFC", "Wells Fargo"),
            Map.entry("AXP", "American Express"), Map.entry("BLK", "BlackRock Inc."),
            Map.entry("JNJ", "Johnson & Johnson"), Map.entry("UNH", "UnitedHealth Group"),
            Map.entry("PFE", "Pfizer Inc."), Map.entry("ABBV", "AbbVie Inc."),
            Map.entry("MRK", "Merck & Co."), Map.entry("LLY", "Eli Lilly & Co."),
            Map.entry("TMO", "Thermo Fisher Scientific"), Map.entry("ABT", "Abbott Labs"),
            Map.entry("XOM", "Exxon Mobil"), Map.entry("CVX", "Chevron Corp."),
            Map.entry("COP", "ConocoPhillips"), Map.entry("SLB", "Schlumberger Ltd."),
            Map.entry("PSX", "Phillips 66"), Map.entry("WMT", "Walmart Inc."),
            Map.entry("HD", "Home Depot Inc."), Map.entry("MCD", "McDonald's Corp."),
            Map.entry("SBUX", "Starbucks Corp."), Map.entry("NKE", "Nike Inc."),
            Map.entry("COST", "Costco Wholesale"), Map.entry("TGT", "Target Corp."),
            Map.entry("BA", "Boeing Co."), Map.entry("CAT", "Caterpillar Inc."),
            Map.entry("HON", "Honeywell International"), Map.entry("UPS", "United Parcel Service"),
            Map.entry("GE", "General Electric"), Map.entry("SPY", "SPDR S&P 500 ETF"),
            Map.entry("QQQ", "Invesco QQQ Trust"), Map.entry("DIA", "SPDR Dow Jones ETF"),
            Map.entry("IWM", "iShares Russell 2000"), Map.entry("VTI", "Vanguard Total Market ETF"),
            Map.entry("PLTR", "Palantir Technologies Inc.")
    );

    public static final Map<String, Double> BASE_PRICES = new HashMap<>(Map.ofEntries(
            Map.entry("AAPL", 225.40), Map.entry("MSFT", 445.20), Map.entry("NVDA", 128.50),
            Map.entry("GOOGL", 178.30), Map.entry("META", 512.60), Map.entry("AMD", 155.80),
            Map.entry("INTC", 31.20), Map.entry("CRM", 258.90), Map.entry("ORCL", 138.40),
            Map.entry("ADBE", 525.10), Map.entry("QCOM", 205.30), Map.entry("TXN", 198.50),
            Map.entry("AMZN", 186.20), Map.entry("TSLA", 248.50), Map.entry("NFLX", 665.40),
            Map.entry("UBER", 72.80), Map.entry("ABNB", 148.60), Map.entry("SNAP", 15.40),
            Map.entry("PINS", 42.10), Map.entry("JPM", 208.50), Map.entry("BAC", 39.80),
            Map.entry("GS", 465.20), Map.entry("MS", 98.40), Map.entry("V", 275.60),
            Map.entry("MA", 458.90), Map.entry("WFC", 58.20), Map.entry("AXP", 232.10),
            Map.entry("BLK", 825.40), Map.entry("JNJ", 148.90), Map.entry("UNH", 518.20),
            Map.entry("PFE", 28.40), Map.entry("ABBV", 172.50), Map.entry("MRK", 128.60),
            Map.entry("LLY", 845.20), Map.entry("TMO", 560.10), Map.entry("ABT", 105.40),
            Map.entry("XOM", 114.80), Map.entry("CVX", 156.20), Map.entry("COP", 112.50),
            Map.entry("SLB", 48.60), Map.entry("PSX", 138.20), Map.entry("WMT", 68.50),
            Map.entry("HD", 352.40), Map.entry("MCD", 258.20), Map.entry("SBUX", 78.40),
            Map.entry("NKE", 75.80), Map.entry("COST", 855.20), Map.entry("TGT", 148.50),
            Map.entry("BA", 178.60), Map.entry("CAT", 328.40), Map.entry("HON", 212.50),
            Map.entry("UPS", 138.20), Map.entry("GE", 162.80), Map.entry("SPY", 548.20),
            Map.entry("QQQ", 482.50), Map.entry("DIA", 405.80), Map.entry("IWM", 218.40),
            Map.entry("VTI", 268.90), Map.entry("PLTR", 32.10)
    ));

    // ─── Sparkline generation (7 realistic price points ending at current price) ───
    private List<Double> generateSparkline(double price, double change, String sym) {
        int n = 7;
        double prevPrice = (change != 0) ? price - change : price * 0.99;
        double step = (price - prevPrice) / (n - 1.0);
        // seed by symbol + hour-bucket so it refreshes each hour but is stable within an hour
        int seed = sym.chars().sum() + (int) (System.currentTimeMillis() / 3_600_000L);
        Random rng = new Random(seed);

        List<Double> pts = new ArrayList<>();
        for (int i = 0; i < n - 1; i++) {
            double base = prevPrice + (step * i);
            double noise = base * (rng.nextDouble() * 0.01 - 0.005); // ±0.5% jitter
            pts.add(Math.round((base + noise) * 100.0) / 100.0);
        }
        pts.add(Math.round(price * 100.0) / 100.0);
        return pts;
    }

    // ─── Single quote (tries Yahoo Finance, falls back to baseline) ──────────
    public StockQuote getQuote(String symbol) {
        String sym = symbol.trim().toUpperCase();
        long now = System.currentTimeMillis();

        if (quoteCache.containsKey(sym) && (now - cacheTimestamps.getOrDefault(sym, 0L) < CACHE_TTL_MS)) {
            return quoteCache.get(sym);
        }

        // Try Yahoo Finance v8 chart API
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + sym + "?interval=1d&range=1d";
            Request request = new Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
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
                        long volume = meta.path("regularMarketVolume").asLong(15_000_000L);

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
                                .history(generateSparkline(price, change, sym))
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

        return buildFallbackQuote(sym, now);
    }

    private StockQuote buildFallbackQuote(String sym, long now) {
        double base = BASE_PRICES.getOrDefault(sym, 150.0);
        // hourly seed for natural-looking variation
        int seed = sym.chars().sum() + (int) (now / 3_600_000L);
        Random rng = new Random(seed);
        double price = Math.round(base * (1.0 + rng.nextDouble() * 0.03 - 0.015) * 100.0) / 100.0;
        double change = Math.round((price - base) * 100.0) / 100.0;
        double changePct = Math.round((change / base) * 10000.0) / 100.0;

        StockQuote fallback = StockQuote.builder()
                .symbol(sym)
                .name(COMPANY_NAMES.getOrDefault(sym, sym))
                .price(price)
                .change(change)
                .changePercent(changePct)
                .dayHigh(Math.round(price * 1.015 * 100.0) / 100.0)
                .dayLow(Math.round(price * 0.985 * 100.0) / 100.0)
                .volume(25_000_000L)
                .timestamp(Instant.now().toString())
                .history(generateSparkline(price, change, sym))
                .build();

        quoteCache.put(sym, fallback);
        cacheTimestamps.put(sym, now);
        return fallback;
    }

    // ─── Multiple quotes as structured response with sectors ─────────────────
    public MultipleStockResponse getMultipleQuotesResponse(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            symbols = ALL_SYMBOLS;
        }
        List<StockQuote> stocks = symbols.stream().map(this::getQuote).toList();
        return MultipleStockResponse.builder()
                .stocks(stocks)
                .cached(false)
                .sectors(SECTORS)
                .build();
    }

    /** Legacy method kept for backward compatibility */
    public List<StockQuote> getMultipleQuotes(List<String> symbols) {
        return getMultipleQuotesResponse(symbols).getStocks();
    }

    // ─── History (for stock-detail chart click) ───────────────────────────────
    public StockHistoryResponse getHistory(String symbol, String period) {
        String sym = symbol.trim().toUpperCase();
        String p = period != null ? period.trim().toLowerCase() : "1mo";
        if ("1m".equals(p)) p = "1mo";

        String range = switch (p) {
            case "1d" -> "1d";
            case "5d" -> "5d";
            case "1y" -> "1y";
            default -> "1mo";
        };

        String interval = switch (p) {
            case "1d" -> "5m";
            case "5d" -> "30m";
            case "1y" -> "1wk";
            default -> "1d";
        };

        DateTimeFormatter dtf;
        if ("1d".equals(p)) {
            dtf = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.of("America/New_York"));
        } else if ("5d".equals(p)) {
            dtf = DateTimeFormatter.ofPattern("EEE HH:mm").withZone(ZoneId.of("America/New_York"));
        } else {
            dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("America/New_York"));
        }

        List<HistoryPoint> points = new ArrayList<>();
        StockDetails details = null;

        // Try Yahoo Finance v8 chart API for real historical points
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + sym
                    + "?range=" + range + "&interval=" + interval;
            Request request = new Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    JsonNode root = objectMapper.readTree(response.body().string());
                    JsonNode resObj = root.path("chart").path("result").get(0);
                    if (resObj != null && !resObj.isMissingNode()) {
                        JsonNode meta = resObj.path("meta");
                        double dayHigh = meta.path("regularMarketDayHigh").asDouble(0.0);
                        double dayLow = meta.path("regularMarketDayLow").asDouble(0.0);
                        long vol = meta.path("regularMarketVolume").asLong(0L);
                        long mcap = meta.path("marketCap").asLong(0L);

                        details = StockDetails.builder()
                                .dayHigh(dayHigh > 0 ? Math.round(dayHigh * 100.0) / 100.0 : null)
                                .dayLow(dayLow > 0 ? Math.round(dayLow * 100.0) / 100.0 : null)
                                .volume(vol > 0 ? vol : null)
                                .marketCap(mcap > 0 ? mcap : null)
                                .build();

                        JsonNode timestamps = resObj.path("timestamp");
                        JsonNode quote = resObj.path("indicators").path("quote").get(0);
                        if (timestamps.isArray() && quote != null) {
                            JsonNode closes = quote.path("close");
                            JsonNode opens = quote.path("open");
                            JsonNode highs = quote.path("high");
                            JsonNode lows = quote.path("low");
                            JsonNode volumes = quote.path("volume");

                            for (int i = 0; i < timestamps.size(); i++) {
                                JsonNode cNode = closes.get(i);
                                if (cNode == null || cNode.isNull()) continue;
                                double close = cNode.asDouble();
                                if (Double.isNaN(close) || close <= 0) continue;

                                long ts = timestamps.get(i).asLong();
                                String dateStr = dtf.format(Instant.ofEpochSecond(ts));

                                double open = (opens.get(i) != null && !opens.get(i).isNull()) ? opens.get(i).asDouble(close) : close;
                                double high = (highs.get(i) != null && !highs.get(i).isNull()) ? highs.get(i).asDouble(close) : close;
                                double low = (lows.get(i) != null && !lows.get(i).isNull()) ? lows.get(i).asDouble(close) : close;
                                long v = (volumes.get(i) != null && !volumes.get(i).isNull()) ? volumes.get(i).asLong(0L) : 0L;

                                points.add(HistoryPoint.builder()
                                        .date(dateStr)
                                        .price(Math.round(close * 100.0) / 100.0)
                                        .close(Math.round(close * 100.0) / 100.0)
                                        .open(Math.round(open * 100.0) / 100.0)
                                        .high(Math.round(high * 100.0) / 100.0)
                                        .low(Math.round(low * 100.0) / 100.0)
                                        .volume(v)
                                        .build());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Live history fetch failed for {}: {}", sym, e.getMessage());
        }

        // Fallback generator if live fetch yields empty points
        if (points.isEmpty()) {
            StockQuote current = getQuote(sym);
            double currentPrice = current.getPrice() != null ? current.getPrice() : BASE_PRICES.getOrDefault(sym, 150.0);
            int count = "1y".equalsIgnoreCase(p) ? 52 : ("1d".equalsIgnoreCase(p) ? 24 : 30);

            Random random = new Random(sym.hashCode() + p.hashCode());
            double price = currentPrice * (1.0 - 0.05 + random.nextDouble() * 0.1);

            for (int i = count - 1; i >= 0; i--) {
                String dateStr;
                if ("1d".equalsIgnoreCase(p)) {
                    int hour = (9 + (count - 1 - i) / 3) % 24;
                    int minute = ((count - 1 - i) % 3) * 20;
                    dateStr = String.format("%02d:%02d", hour, minute);
                } else if ("5d".equalsIgnoreCase(p)) {
                    dateStr = LocalDate.now().minusDays(i / 5).getDayOfWeek().name().substring(0, 3) + " " + String.format("%02d:00", (10 + (i % 5) * 2));
                } else {
                    dateStr = LocalDate.now().minusDays(i).toString();
                }

                double open = price;
                double close = (i == 0) ? currentPrice : Math.round(price * (1 + random.nextDouble() * 0.02 - 0.01) * 100.0) / 100.0;
                double high = Math.round(Math.max(open, close) * (1 + random.nextDouble() * 0.008) * 100.0) / 100.0;
                double low = Math.round(Math.min(open, close) * (1 - random.nextDouble() * 0.008) * 100.0) / 100.0;
                long vol = (long) (15_000_000 + random.nextInt(30_000_000));

                points.add(HistoryPoint.builder()
                        .date(dateStr)
                        .price(close)
                        .close(close)
                        .open(open)
                        .high(high)
                        .low(low)
                        .volume(vol)
                        .build());
                price = close;
            }

            if (details == null) {
                details = StockDetails.builder()
                        .dayHigh(current.getDayHigh())
                        .dayLow(current.getDayLow())
                        .volume(current.getVolume())
                        .marketCap(current.getMarketCap())
                        .build();
            }
        }

        return StockHistoryResponse.builder()
                .symbol(sym)
                .period(p)
                .data(points)
                .details(details)
                .build();
    }
}
