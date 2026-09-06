package com.knowledge.worker.service;

import com.knowledge.worker.dto.NewsDto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class NewsService {

    public NewsResponse getNews(int page, String category, String topic) {
        String cat = category != null && !category.isBlank() ? category.toLowerCase() : "all";
        List<Article> curated = generateCuratedArticles(cat, topic);

        int pageSize = 6;
        int fromIndex = Math.min((page - 1) * pageSize, curated.size());
        int toIndex = Math.min(fromIndex + pageSize, curated.size());

        List<Article> pagedArticles = curated.subList(fromIndex, toIndex);

        return NewsResponse.builder()
                .articles(pagedArticles)
                .page(page)
                .totalResults(curated.size())
                .build();
    }

    private List<Article> generateCuratedArticles(String category, String topic) {
        Instant now = Instant.now();
        List<Article> list = new ArrayList<>();

        list.add(Article.builder()
                .title("Tech Giants Accelerate Next-Gen AI Infrastructure Investments")
                .description("Cloud hyperscalers report record enterprise adoption of autonomous agent systems and large-scale accelerated computing clusters.")
                .source("Reuters Technology")
                .url("https://www.reuters.com/technology")
                .publishedAt(now.minus(1, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60")
                .category("technology")
                .build());

        list.add(Article.builder()
                .title("Federal Reserve Signals Cautious Rate Trajectory Amid Growth Resilience")
                .description("Central bankers weigh inflation metrics and robust labor figures as treasury yields adjust across global financial markets.")
                .source("Bloomberg Markets")
                .url("https://www.bloomberg.com/markets")
                .publishedAt(now.minus(3, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=60")
                .category("business")
                .build());

        list.add(Article.builder()
                .title("Semiconductor Rally Continues as Demand Outpaces Advanced Packaging Supply")
                .description("Surging GPU and TPU orders fuel record revenue across chip designers and foundry supply chains globally.")
                .source("Financial Times")
                .url("https://www.ft.com/technology")
                .publishedAt(now.minus(5, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=60")
                .category("technology")
                .build());

        list.add(Article.builder()
                .title("Electric Vehicle Producers Unveil Next-Generation Autonomous Driving Architectures")
                .description("Automakers showcase end-to-end neural network driving stacks and expanded robotaxi commercial pilots.")
                .source("Wall Street Journal")
                .url("https://www.wsj.com")
                .publishedAt(now.minus(7, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=60")
                .category("business")
                .build());

        list.add(Article.builder()
                .title("Renewable Energy Infrastructure Reaches Record Grid Share Across Key Hubs")
                .description("Solar and battery storage installations surge as utilities modernize grid stability frameworks.")
                .source("CNBC Energy")
                .url("https://www.cnbc.com/energy")
                .publishedAt(now.minus(12, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&auto=format&fit=crop&q=60")
                .category("science")
                .build());

        list.add(Article.builder()
                .title("Cybersecurity Protocols Tighten as Autonomous Threat Defenses Gain Ground")
                .description("Enterprise security leaders adopt real-time behavioral anomaly detection to counter sophisticated vector intrusions.")
                .source("TechCrunch")
                .url("https://techcrunch.com")
                .publishedAt(now.minus(18, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60")
                .category("technology")
                .build());

        return list;
    }
}
