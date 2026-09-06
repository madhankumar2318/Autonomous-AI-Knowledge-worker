package com.knowledge.worker.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.StockDto;
import com.knowledge.worker.service.StockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
@RequiredArgsConstructor
public class LiveWebSocketHandler extends TextWebSocketHandler {

    private final StockService stockService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        log.info("[WS] Live visual client connected: {}", session.getId());
        sendInitialData(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        log.info("[WS] Client disconnected: {}", session.getId());
    }

    private void sendInitialData(WebSocketSession session) {
        try {
            List<StockDto.StockQuote> quotes = stockService.getMultipleQuotes(List.of("AAPL", "TSLA", "NVDA", "MSFT"));
            String json = objectMapper.writeValueAsString(Map.of(
                    "type", "stock_batch",
                    "data", quotes
            ));
            session.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.warn("Failed to send initial WS data: {}", e.getMessage());
        }
    }
}
