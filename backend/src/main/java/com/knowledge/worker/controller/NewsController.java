package com.knowledge.worker.controller;

import com.knowledge.worker.dto.NewsDto.*;
import com.knowledge.worker.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/news", "/news/"})
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    public ResponseEntity<NewsResponse> getNews(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String topic) {

        return ResponseEntity.ok(newsService.getNews(page, category, topic));
    }
}
