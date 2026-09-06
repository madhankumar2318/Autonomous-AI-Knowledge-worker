package com.knowledge.worker.controller;

import com.knowledge.worker.dto.SearchDto.*;
import com.knowledge.worker.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/search", "/search/"})
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<SearchResponse> search(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "1") int page) {

        return ResponseEntity.ok(searchService.search(query, page));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<String>> getSuggestions(@RequestParam(name = "q", defaultValue = "") String q) {
        return ResponseEntity.ok(searchService.getSuggestions(q));
    }
}
