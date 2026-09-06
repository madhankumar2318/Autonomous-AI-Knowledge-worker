package com.knowledge.worker.controller;

import com.knowledge.worker.dto.StockDto.*;
import com.knowledge.worker.service.StockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/stock", "/stock/"})
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    @GetMapping
    public ResponseEntity<StockQuote> getStock(@RequestParam(defaultValue = "AAPL") String symbol) {
        return ResponseEntity.ok(stockService.getQuote(symbol));
    }

    @GetMapping("/multiple")
    public ResponseEntity<List<StockQuote>> getMultipleStocks(@RequestParam(required = false) List<String> symbols) {
        return ResponseEntity.ok(stockService.getMultipleQuotes(symbols));
    }

    @GetMapping("/history/{symbol}")
    public ResponseEntity<StockHistoryResponse> getHistory(@PathVariable String symbol,
                                                           @RequestParam(defaultValue = "7d") String period) {
        return ResponseEntity.ok(stockService.getHistory(symbol, period));
    }
}
