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
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    private static final List<String> TRENDING_SEARCHES = List.of(
            "NVIDIA Blackwell AI chips",
            "Federal Reserve interest rate decision",
            "Tesla Robotaxi launch date",
            "Apple WWDC 2026 announcements",
            "OpenAI GPT-5 release",
            "Bitcoin ETF approval news",
            "SpaceX Starship orbital flight",
            "Meta AI Llama 4 benchmarks",
            "Google Gemini 2.5 Pro update",
            "Amazon AWS re:Invent keynote"
    );

    // ─── Main Search ─────────────────────────────────────────────────────────
    public SearchResponse search(String query, int page) {
        String cleanQuery = query != null ? query.trim() : "";
        if (cleanQuery.isEmpty()) {
            return SearchResponse.builder()
                    .query(cleanQuery).page(page).total(0)
                    .results(List.of()).engines(List.of()).build();
        }

        List<SearchResultItem> combined = new ArrayList<>();
        List<String> engines = new ArrayList<>();

        // 1. Google News RSS (news tab: fresh=true)
        try {
            List<SearchResultItem> newsItems = fetchGoogleNewsRss(cleanQuery, 8);
            if (!newsItems.isEmpty()) {
                combined.addAll(newsItems);
                engines.add("google_news_rss");
            }
        } catch (Exception e) {
            log.warn("[Search] Google News RSS error: {}", e.getMessage());
        }

        // 2. Bing News RSS (additional news results)
        try {
            List<SearchResultItem> bingItems = fetchBingNewsRss(cleanQuery, 5);
            if (!bingItems.isEmpty()) {
                combined.addAll(bingItems);
                engines.add("bing_news_rss");
            }
        } catch (Exception e) {
            log.warn("[Search] Bing News RSS error: {}", e.getMessage());
        }

        // 3. YouTube Video Search (videos tab: is_video=true)
        try {
            List<SearchResultItem> ytItems = fetchYouTubeVideos(cleanQuery, 6);
            if (!ytItems.isEmpty()) {
                combined.addAll(ytItems);
                engines.add("youtube");
            }
        } catch (Exception e) {
            log.warn("[Search] YouTube search error: {}", e.getMessage());
        }

        // 4. SerpAPI Google Web Search (if key configured)
        if (serpApiKey != null && serpApiKey.length() > 10) {
            try {
                List<SearchResultItem> serpItems = fetchSerpApi(cleanQuery, page);
                if (!serpItems.isEmpty()) {
                    combined.addAll(serpItems);
                    engines.add("serpapi");
                }
            } catch (Exception e) {
                log.warn("[Search] SerpAPI error: {}", e.getMessage());
            }
        }

        // 5. Wikipedia Search (web tab: definitions)
        try {
            List<SearchResultItem> wikiItems = fetchWikipedia(cleanQuery, 3);
            if (!wikiItems.isEmpty()) {
                combined.addAll(wikiItems);
                engines.add("wikipedia");
            }
        } catch (Exception e) {
            log.warn("[Search] Wikipedia error: {}", e.getMessage());
        }

        // 6. DuckDuckGo HTML fallback
        try {
            List<SearchResultItem> ddgItems = fetchDuckDuckGo(cleanQuery, 6);
            if (!ddgItems.isEmpty()) {
                combined.addAll(ddgItems);
                engines.add("duckduckgo_web");
            }
        } catch (Exception e) {
            log.warn("[Search] DuckDuckGo error: {}", e.getMessage());
        }

        // 7. If still empty, add curated fallback links
        if (combined.isEmpty()) {
            combined.addAll(buildFallbackResults(cleanQuery));
            engines.add("curated");
        }

        return SearchResponse.builder()
                .query(cleanQuery)
                .page(page)
                .total(combined.size())
                .results(combined)
                .engines(engines)
                .build();
    }

    // ─── Google News RSS ──────────────────────────────────────────────────────
    private List<SearchResultItem> fetchGoogleNewsRss(String query, int maxResults) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://news.google.com/rss/search?q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&hl=en-US&gl=US&ceid=US:en";

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (compatible; NewsBot/1.0)")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                String xml = resp.body().string();
                items = parseNewsRss(xml, "Google News", maxResults, true);
            }
        } catch (Exception e) {
            log.warn("[Search] Google News RSS: {}", e.getMessage());
        }
        return items;
    }

    // ─── Bing News RSS ────────────────────────────────────────────────────────
    private List<SearchResultItem> fetchBingNewsRss(String query, int maxResults) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://www.bing.com/news/search?q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&format=rss";

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                items = parseNewsRss(resp.body().string(), "Bing News", maxResults, true);
            }
        } catch (Exception e) {
            log.warn("[Search] Bing News RSS: {}", e.getMessage());
        }
        return items;
    }

    private List<SearchResultItem> parseNewsRss(String xml, String defaultSource, int maxResults, boolean fresh) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            NodeList nodeList = doc.getElementsByTagName("item");

            for (int i = 0; i < Math.min(nodeList.getLength(), maxResults); i++) {
                Element item = (Element) nodeList.item(i);
                String title = getText(item, "title");
                String link = getText(item, "link");
                String description = getText(item, "description");
                String source = getText(item, "source");
                String pubDate = getText(item, "pubDate");

                if (title == null || link == null || link.isBlank()) continue;
                if (description != null) {
                    description = description.replaceAll("<[^>]+>", "").trim();
                    if (description.length() > 180) description = description.substring(0, 180) + "…";
                }
                if (source == null || source.isBlank()) source = defaultSource;

                String timeStr = "";
                if (pubDate != null && !pubDate.isBlank()) {
                    timeStr = "🕐 " + pubDate + " — ";
                }

                items.add(SearchResultItem.builder()
                        .title(title)
                        .link(link)
                        .snippet(timeStr + (description != null ? description : title))
                        .source(source)
                        .fresh(fresh)
                        .isVideo(false)
                        .build());
            }
        } catch (Exception e) {
            log.warn("[Search] RSS parse error: {}", e.getMessage());
        }
        return items;
    }

    // ─── YouTube Video Search (scrape ytInitialData JSON) ────────────────────
    private List<SearchResultItem> fetchYouTubeVideos(String query, int maxResults) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://www.youtube.com/results?search_query="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8);

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                String html = resp.body().string();

                // Extract ytInitialData JSON
                Pattern p = Pattern.compile("var ytInitialData = (\\{.*?\\});</script>", Pattern.DOTALL);
                Matcher m = p.matcher(html);
                if (!m.find()) {
                    // Fallback: try window["ytInitialData"] pattern
                    p = Pattern.compile("window\\[\"ytInitialData\"\\] = (\\{.*?\\});", Pattern.DOTALL);
                    m = p.matcher(html);
                    if (!m.find()) return items;
                }

                JsonNode root = objectMapper.readTree(m.group(1));
                JsonNode contents = root.path("contents")
                        .path("twoColumnSearchResultsRenderer")
                        .path("primaryContents")
                        .path("sectionListRenderer")
                        .path("contents");

                if (!contents.isArray()) return items;

                for (JsonNode section : contents) {
                    JsonNode itemSection = section.path("itemSectionRenderer").path("contents");
                    if (!itemSection.isArray()) continue;
                    for (JsonNode videoNode : itemSection) {
                        JsonNode video = videoNode.path("videoRenderer");
                        if (video.isMissingNode()) continue;

                        String videoId = video.path("videoId").asText("");
                        if (videoId.isBlank()) continue;

                        String title = video.path("title").path("runs").get(0) != null
                                ? video.path("title").path("runs").get(0).path("text").asText("") : "";
                        String channel = video.path("ownerText").path("runs").get(0) != null
                                ? video.path("ownerText").path("runs").get(0).path("text").asText("") : "";
                        String published = video.path("publishedTimeText").path("simpleText").asText("");
                        String views = video.path("viewCountText").path("simpleText").asText("");

                        if (title.isBlank()) continue;

                        String link = "https://www.youtube.com/watch?v=" + videoId;
                        String thumbnail = "https://i.ytimg.com/vi/" + videoId + "/mqdefault.jpg";
                        String snippet = (channel.isBlank() ? "" : channel + " • ")
                                + (views.isBlank() ? "" : views + " • ")
                                + (published.isBlank() ? "" : "🕐 " + published);

                        items.add(SearchResultItem.builder()
                                .title(title)
                                .link(link)
                                .snippet(snippet.strip().replaceAll("^•\\s*|\\s*•\\s*$", ""))
                                .source("YouTube")
                                .fresh(false)
                                .isVideo(true)
                                .thumbnail(thumbnail)
                                .videoId(videoId)
                                .channel(channel)
                                .views(views)
                                .build());

                        if (items.size() >= maxResults) return items;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Search] YouTube scrape error: {}", e.getMessage());
        }
        return items;
    }

    // ─── SerpAPI ──────────────────────────────────────────────────────────────
    private List<SearchResultItem> fetchSerpApi(String query, int page) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://serpapi.com/search.json?engine=google&q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&api_key=" + serpApiKey + "&num=10&start=" + ((page - 1) * 10);

            Request req = new Request.Builder().url(url).build();
            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                JsonNode root = objectMapper.readTree(resp.body().string());
                JsonNode organic = root.path("organic_results");
                if (organic.isArray()) {
                    for (JsonNode node : organic) {
                        items.add(SearchResultItem.builder()
                                .title(node.path("title").asText("Result"))
                                .link(node.path("link").asText("#"))
                                .snippet(node.path("snippet").asText(""))
                                .source("Google")
                                .fresh(false)
                                .isVideo(false)
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Search] SerpAPI: {}", e.getMessage());
        }
        return items;
    }

    // ─── Wikipedia ────────────────────────────────────────────────────────────
    private List<SearchResultItem> fetchWikipedia(String query, int maxResults) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&srlimit=" + maxResults + "&format=json&utf8=1";

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "AKWSearchBot/1.0")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                JsonNode root = objectMapper.readTree(resp.body().string());
                JsonNode search = root.path("query").path("search");
                if (search.isArray()) {
                    for (JsonNode result : search) {
                        String title = result.path("title").asText("");
                        String snippet = result.path("snippet").asText("").replaceAll("<[^>]+>", "").trim();
                        String pageid = result.path("pageid").asText("");
                        String link = "https://en.wikipedia.org/wiki/"
                                + URLEncoder.encode(title.replace(" ", "_"), StandardCharsets.UTF_8);

                        if (!title.isBlank()) {
                            items.add(SearchResultItem.builder()
                                    .title("📖 " + title)
                                    .link(link)
                                    .snippet(snippet.length() > 200 ? snippet.substring(0, 200) + "…" : snippet)
                                    .source("Wikipedia")
                                    .fresh(false)
                                    .isVideo(false)
                                    .build());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Search] Wikipedia: {}", e.getMessage());
        }
        return items;
    }

    // ─── DuckDuckGo HTML Fallback ─────────────────────────────────────────────
    private List<SearchResultItem> fetchDuckDuckGo(String query, int maxResults) {
        List<SearchResultItem> items = new ArrayList<>();
        try {
            String url = "https://html.duckduckgo.com/html/?q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8);

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (!resp.isSuccessful() || resp.body() == null) return items;
                String html = resp.body().string();

                // Extract result snippets via regex (simple DDG HTML structure)
                Pattern titlePat = Pattern.compile("class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>([^<]+)</a>");
                Pattern snippetPat = Pattern.compile("class=\"result__snippet\"[^>]*>([^<]+)</");

                Matcher titleMatcher = titlePat.matcher(html);
                Matcher snippetMatcher = snippetPat.matcher(html);

                while (titleMatcher.find() && items.size() < maxResults) {
                    String link = titleMatcher.group(1);
                    String title = titleMatcher.group(2).trim();
                    String snippet = snippetMatcher.find() ? snippetMatcher.group(1).trim() : "";

                    // Decode DDG redirect URL
                    if (link.startsWith("//duckduckgo.com/l/?uddg=")) {
                        try {
                            link = java.net.URLDecoder.decode(link.replace("//duckduckgo.com/l/?uddg=", ""), "UTF-8");
                        } catch (Exception ignored) {}
                    }

                    if (!title.isBlank() && link.startsWith("http")) {
                        items.add(SearchResultItem.builder()
                                .title(title)
                                .link(link)
                                .snippet(snippet)
                                .source(extractDomain(link))
                                .fresh(false)
                                .isVideo(false)
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Search] DuckDuckGo: {}", e.getMessage());
        }
        return items;
    }

    // ─── Curated Fallback Results ─────────────────────────────────────────────
    private List<SearchResultItem> buildFallbackResults(String query) {
        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return List.of(
                SearchResultItem.builder()
                        .title("Market & Financial Intelligence: " + query)
                        .link("https://finance.yahoo.com/lookup?s=" + encoded)
                        .snippet("Real-time financial metrics, SEC filings, and market intelligence for " + query + ".")
                        .source("Yahoo Finance")
                        .fresh(false).isVideo(false).build(),
                SearchResultItem.builder()
                        .title("Latest News on: " + query)
                        .link("https://news.google.com/search?q=" + encoded)
                        .snippet("Aggregated industry developments, executive interviews, and news on " + query + ".")
                        .source("Google News")
                        .fresh(true).isVideo(false).build(),
                SearchResultItem.builder()
                        .title("YouTube Videos: " + query)
                        .link("https://www.youtube.com/results?search_query=" + encoded)
                        .snippet("Watch videos and tutorials about " + query + " on YouTube.")
                        .source("YouTube")
                        .fresh(false).isVideo(false).build()
        );
    }

    // ─── Suggestions & Trending ───────────────────────────────────────────────
    public SuggestionsResponse getSuggestionsResponse(String query) {
        if (query == null || query.isBlank()) {
            return SuggestionsResponse.builder()
                    .query("")
                    .suggestions(List.of())
                    .trending(TRENDING_SEARCHES)
                    .build();
        }

        List<String> suggestions = new ArrayList<>();

        // 1. Google Chrome Suggest API
        try {
            String url = "https://suggestqueries.google.com/complete/search?client=chrome&q="
                    + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);

            Request req = new Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .build();

            try (Response resp = httpClient.newCall(req).execute()) {
                if (resp.isSuccessful() && resp.body() != null) {
                    JsonNode root = objectMapper.readTree(resp.body().string());
                    if (root.isArray() && root.size() > 1 && root.get(1).isArray()) {
                        for (JsonNode item : root.get(1)) {
                            suggestions.add(item.asText());
                            if (suggestions.size() >= 8) break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Search] Google suggest: {}", e.getMessage());
        }

        // 2. DuckDuckGo autocomplete fallback
        if (suggestions.isEmpty()) {
            try {
                String url = "https://duckduckgo.com/ac/?q="
                        + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8) + "&type=list";

                Request req = new Request.Builder().url(url)
                        .header("User-Agent", "Mozilla/5.0")
                        .build();

                try (Response resp = httpClient.newCall(req).execute()) {
                    if (resp.isSuccessful() && resp.body() != null) {
                        JsonNode root = objectMapper.readTree(resp.body().string());
                        if (root.isArray() && root.size() > 1 && root.get(1).isArray()) {
                            for (JsonNode item : root.get(1)) {
                                suggestions.add(item.asText());
                                if (suggestions.size() >= 8) break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[Search] DDG suggest: {}", e.getMessage());
            }
        }

        return SuggestionsResponse.builder()
                .query(query.trim())
                .suggestions(suggestions)
                .trending(TRENDING_SEARCHES)
                .build();
    }

    /** Legacy method returning just the suggestion strings (used by old controller signature) */
    public List<String> getSuggestions(String query) {
        return getSuggestionsResponse(query).getSuggestions();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    private String getText(Element parent, String tag) {
        NodeList nl = parent.getElementsByTagName(tag);
        if (nl.getLength() > 0 && nl.item(0) != null) {
            return nl.item(0).getTextContent().trim();
        }
        return null;
    }

    private String extractDomain(String url) {
        try {
            return new java.net.URL(url).getHost().replaceFirst("^www\\.", "");
        } catch (Exception e) {
            return url;
        }
    }
}
