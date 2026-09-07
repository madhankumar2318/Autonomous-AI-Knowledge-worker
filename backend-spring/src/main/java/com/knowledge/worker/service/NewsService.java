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
        String cat = category != null && !category.isBlank() ? category.toLowerCase().trim() : "all";
        List<Article> allArticles = generateCuratedArticles();

        List<Article> filtered = allArticles;
        if (!"all".equals(cat) && !cat.isEmpty()) {
            List<Article> byCat = allArticles.stream()
                    .filter(a -> cat.equalsIgnoreCase(a.getCategory()))
                    .toList();
            if (!byCat.isEmpty()) {
                filtered = byCat;
            }
        }

        if (topic != null && !topic.isBlank()) {
            String lowerTopic = topic.toLowerCase().trim();
            List<Article> byTopic = filtered.stream()
                    .filter(a -> (a.getTitle() != null && a.getTitle().toLowerCase().contains(lowerTopic)) ||
                                 (a.getDescription() != null && a.getDescription().toLowerCase().contains(lowerTopic)))
                    .toList();
            if (!byTopic.isEmpty()) {
                filtered = byTopic;
            }
        }

        int pageSize = 12;
        int safePage = Math.max(1, page);
        int fromIndex = Math.min((safePage - 1) * pageSize, filtered.size());
        int toIndex = Math.min(fromIndex + pageSize, filtered.size());

        List<Article> pagedArticles = filtered.subList(fromIndex, toIndex);

        return NewsResponse.builder()
                .articles(pagedArticles)
                .page(safePage)
                .totalResults(filtered.size())
                .build();
    }

    private List<Article> generateCuratedArticles() {
        Instant now = Instant.now();
        List<Article> list = new ArrayList<>();

        // Technology
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
                .title("Semiconductor Rally Continues as Demand Outpaces Advanced Packaging Supply")
                .description("Surging GPU and TPU orders fuel record revenue across chip designers and foundry supply chains globally.")
                .source("Financial Times")
                .url("https://www.ft.com/technology")
                .publishedAt(now.minus(4, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=60")
                .category("technology")
                .build());

        list.add(Article.builder()
                .title("Cybersecurity Protocols Tighten as Autonomous Threat Defenses Gain Ground")
                .description("Enterprise security leaders adopt real-time behavioral anomaly detection to counter sophisticated vector intrusions.")
                .source("TechCrunch")
                .url("https://techcrunch.com")
                .publishedAt(now.minus(7, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60")
                .category("technology")
                .build());

        // Business
        list.add(Article.builder()
                .title("Federal Reserve Signals Cautious Rate Trajectory Amid Growth Resilience")
                .description("Central bankers weigh inflation metrics and robust labor figures as treasury yields adjust across global financial markets.")
                .source("Bloomberg Markets")
                .url("https://www.bloomberg.com/markets")
                .publishedAt(now.minus(2, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=60")
                .category("business")
                .build());

        list.add(Article.builder()
                .title("Global Supply Chains Stabilize as Maritime Logistics Modernize with Automation")
                .description("Port operators and freight carriers deploy predictive routing systems to mitigate container port congestions.")
                .source("Wall Street Journal")
                .url("https://www.wsj.com")
                .publishedAt(now.minus(5, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=60")
                .category("business")
                .build());

        list.add(Article.builder()
                .title("Electric Vehicle Producers Unveil Next-Generation Autonomous Driving Architectures")
                .description("Automakers showcase end-to-end neural network driving stacks and expanded robotaxi commercial pilots.")
                .source("Wall Street Journal")
                .url("https://www.wsj.com")
                .publishedAt(now.minus(8, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=60")
                .category("business")
                .build());

        // Science
        list.add(Article.builder()
                .title("Renewable Energy Infrastructure Reaches Record Grid Share Across Key Hubs")
                .description("Solar and battery storage installations surge as utilities modernize grid stability frameworks.")
                .source("CNBC Energy")
                .url("https://www.cnbc.com/energy")
                .publishedAt(now.minus(3, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&auto=format&fit=crop&q=60")
                .category("science")
                .build());

        list.add(Article.builder()
                .title("Deep Space Telescopes Capture High-Resolution Spectra of Earth-Mass Exoplanet")
                .description("Astrophysicists identify atmospheric chemical biosignatures that provide clues to prebiotic planetary conditions.")
                .source("Nature Science")
                .url("https://www.nature.com")
                .publishedAt(now.minus(6, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=60")
                .category("science")
                .build());

        // Health
        list.add(Article.builder()
                .title("Novel Targeted mRNA Therapeutics Advance Through Late-Stage Clinical Trials")
                .description("Oncology researchers report notable progress in personalized cancer vaccines designed through computational biology.")
                .source("BioWorld Health")
                .url("https://www.bioworld.com")
                .publishedAt(now.minus(4, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&auto=format&fit=crop&q=60")
                .category("health")
                .build());

        // Sports
        list.add(Article.builder()
                .title("Global Championship Final Highlights Technological Innovations in Athlete Performance")
                .description("Wearable biomechanics sensors and predictive telemetry revolutionize training regimens at the highest tier of sports.")
                .source("ESPN Global")
                .url("https://www.espn.com")
                .publishedAt(now.minus(9, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=60")
                .category("sports")
                .build());

        // Entertainment
        list.add(Article.builder()
                .title("Streaming Platforms Shift Strategy Toward Interactive and Real-Time Entertainment Experiences")
                .description("Studios explore immersive multi-angle live broadcasts and generative interactive narrative formats.")
                .source("Variety Media")
                .url("https://variety.com")
                .publishedAt(now.minus(11, ChronoUnit.HOURS).toString())
                .urlToImage("https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=60")
                .category("entertainment")
                .build());

        return list;
    }
}
