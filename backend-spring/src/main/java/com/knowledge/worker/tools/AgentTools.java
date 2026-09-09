package com.knowledge.worker.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.NewsDto;
import com.knowledge.worker.dto.SearchDto;
import com.knowledge.worker.dto.StockDto;
import com.knowledge.worker.service.NewsService;
import com.knowledge.worker.service.SearchService;
import com.knowledge.worker.service.StockService;
import com.knowledge.worker.service.DocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@Slf4j
@RequiredArgsConstructor
public class AgentTools {

    private final StockService stockService;
    private final NewsService newsService;
    private final SearchService searchService;
    private final DocumentService documentService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> getOpenAiToolDefinitions() {
        return List.of(
                Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", "get_stock_price",
                                "description", "Get the current stock price and key market financial metrics for a given ticker symbol (e.g. AAPL, TSLA, NVDA, GOOGL).",
                                "parameters", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "symbol", Map.of("type", "string", "description", "Stock ticker symbol, e.g. TSLA, NVDA")
                                        ),
                                        "required", List.of("symbol")
                                )
                        )
                ),
                Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", "get_latest_news",
                                "description", "Fetch current live market and technology news headlines and summaries.",
                                "parameters", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "category", Map.of("type", "string", "description", "News category e.g. business, technology, science"),
                                                "topic", Map.of("type", "string", "description", "Specific keyword or company name")
                                        )
                                )
                        )
                ),
                Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", "web_search",
                                "description", "Search the web for up-to-date information, corporate data, or questions requiring external research.",
                                "parameters", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "query", Map.of("type", "string", "description", "The search query")
                                        ),
                                        "required", List.of("query")
                                )
                        )
                ),
                Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", "search_knowledge_base",
                                "description", "Search the uploaded documents in the workspace (PDFs, CSVs, TXT, JSON, MD, resumes) for relevant facts, numbers, and excerpts.",
                                "parameters", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "query", Map.of("type", "string", "description", "The search query to match against document contents.")
                                        ),
                                        "required", List.of("query")
                                )
                        )
                ),
                Map.of(
                        "type", "function",
                        "function", Map.of(
                                "name", "read_uploaded_file",
                                "description", "Read the entire text content of a specific uploaded file in the workspace by filename (e.g. Madhans_Resume_1.pdf).",
                                "parameters", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "filename", Map.of("type", "string", "description", "The exact or approximate filename to read, e.g. Madhans_Resume_1.pdf")
                                        ),
                                        "required", List.of("filename")
                                )
                        )
                )
        );
    }

    public String executeTool(String toolName, Map<String, Object> arguments) {
        log.info("[Agent Tool Call] {} with args: {}", toolName, arguments);
        try {
            switch (toolName) {
                case "get_stock_price": {
                    String symbol = String.valueOf(arguments.getOrDefault("symbol", "AAPL"));
                    StockDto.StockQuote quote = stockService.getQuote(symbol);
                    return String.format("Stock: %s (%s) | Price: $%.2f | Change: $%.2f (%.2f%%) | Day High: $%.2f | Day Low: $%.2f | Volume: %d",
                            quote.getName(), quote.getSymbol(), quote.getPrice(),
                            quote.getChange(), quote.getChangePercent(),
                            quote.getDayHigh(), quote.getDayLow(), quote.getVolume());
                }
                case "get_latest_news": {
                    String category = arguments.containsKey("category") ? String.valueOf(arguments.get("category")) : "";
                    String topic = arguments.containsKey("topic") ? String.valueOf(arguments.get("topic")) : "";
                    NewsDto.NewsResponse news = newsService.getNews(1, category, topic);
                    StringBuilder sb = new StringBuilder("Top News Articles:\n");
                    for (int i = 0; i < news.getArticles().size(); i++) {
                        NewsDto.Article a = news.getArticles().get(i);
                        sb.append(String.format("[%d] %s (Source: %s)\n    %s\n", i + 1, a.getTitle(), a.getSource(), a.getDescription()));
                    }
                    return sb.toString();
                }
                case "web_search": {
                    String query = String.valueOf(arguments.getOrDefault("query", ""));
                    SearchDto.SearchResponse res = searchService.search(query, 1);
                    StringBuilder sb = new StringBuilder("Web Search Results:\n");
                    for (SearchDto.SearchResultItem item : res.getResults()) {
                        sb.append(String.format("- %s: %s (URL: %s)\n", item.getTitle(), item.getSnippet(), item.getLink()));
                    }
                    return sb.toString();
                }
                case "search_knowledge_base": {
                    String query = String.valueOf(arguments.getOrDefault("query", ""));
                    return documentService.searchKnowledge(query, null);
                }
                case "read_uploaded_file": {
                    String filename = String.valueOf(arguments.getOrDefault("filename", ""));
                    return documentService.extractDocumentText(filename);
                }
                default:
                    return "Error: Unknown tool " + toolName;
            }
        } catch (Exception e) {
            log.error("Tool execution failed: {}", e.getMessage());
            return "Error executing tool " + toolName + ": " + e.getMessage();
        }
    }
}
