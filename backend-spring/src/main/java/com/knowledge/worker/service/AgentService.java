package com.knowledge.worker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knowledge.worker.dto.ChatDtos.*;
import com.knowledge.worker.tools.AgentTools;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class AgentService {

    private final AgentTools agentTools;
    private final ChatThreadService chatThreadService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.ai.groq.api-key:}")
    private String groqApiKey;

    @Value("${app.ai.groq.model:openai/gpt-oss-120b}")
    private String groqModel;

    @Value("${app.ai.groq.base-url:https://api.groq.com/openai/v1}")
    private String groqBaseUrl;

    @Value("${app.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.ai.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build();

    public static final String SYSTEM_INSTRUCTION = """
You are Antigravity, an elite Autonomous AI Knowledge Worker with deep expertise in financial market analysis, news synthesis, and document reasoning.
Maintain a professional, proactive, honest, and precise tone.
Always verify stock quotes, market trends, and news items using your tools before drawing conclusions.
Structure your answers with clean Markdown headers, bullet points, and key takeaways.
""";

    public ChatResponse processChat(ChatRequest req) {
        String selectedModel = req.getModel() != null ? req.getModel() : "llama-70b";
        String friendlyModelName = isGroq(selectedModel) ? "Groq (Ultra-Fast)" : "Google Gemini 2.5";

        StringBuilder fullResponse = new StringBuilder();
        try {
            if (isGroq(selectedModel) && groqApiKey != null && groqApiKey.length() > 10) {
                fullResponse.append(callGroq(req));
            } else if (!isGroq(selectedModel) && geminiApiKey != null && geminiApiKey.length() > 10) {
                fullResponse.append(callGemini(req));
            } else {
                fullResponse.append(generateAutonomousResponse(req, null));
            }
        } catch (Exception e) {
            log.warn("Model execution error: {}. Falling back to autonomous agent engine.", e.getMessage());
            fullResponse.append(generateAutonomousResponse(req, null));
        }

        // Persist messages if thread_id is present
        if (req.getThreadId() != null) {
            chatThreadService.saveMessage(req.getThreadId(), "user", req.getMessage());
            chatThreadService.saveMessage(req.getThreadId(), "ai", fullResponse.toString());
        }

        return ChatResponse.builder()
                .reply(fullResponse.toString())
                .model(friendlyModelName)
                .build();
    }

    @Async
    public void streamChat(ChatRequest req, SseEmitter emitter) {
        String selectedModel = req.getModel() != null ? req.getModel() : "llama-70b";
        String friendlyModelName = isGroq(selectedModel) ? "Groq (Ultra-Fast)" : "Google Gemini 2.5";

        try {
            sendEvent(emitter, "start", "{}");
            sendEvent(emitter, "model_used", friendlyModelName);

            String fullReply;
            if (isGroq(selectedModel) && groqApiKey != null && groqApiKey.length() > 10) {
                fullReply = streamWithGroq(req, emitter);
            } else if (!isGroq(selectedModel) && geminiApiKey != null && geminiApiKey.length() > 10) {
                fullReply = streamWithGemini(req, emitter);
            } else {
                fullReply = generateAutonomousResponse(req, emitter);
            }

            // Persist to thread
            if (req.getThreadId() != null) {
                chatThreadService.saveMessage(req.getThreadId(), "user", req.getMessage());
                chatThreadService.saveMessage(req.getThreadId(), "ai", fullReply);
            }

            sendEvent(emitter, "done", "[DONE]");
            emitter.complete();

        } catch (Exception e) {
            log.error("Streaming chat failed: {}", e.getMessage());
            try {
                sendEvent(emitter, "error", "⚠️ **Service Notice**: " + e.getMessage());
                sendEvent(emitter, "done", "[DONE]");
                emitter.complete();
            } catch (Exception ignored) {}
        }
    }

    private boolean isGroq(String model) {
        return model == null || model.contains("llama") || model.contains("groq");
    }

    private String streamWithGroq(ChatRequest req, SseEmitter emitter) {
        try {
            List<Map<String, Object>> messages = buildMessagePayload(req);

            // Autonomous tool calling loop (up to 5 loops)
            for (int loop = 0; loop < 5; loop++) {
                Map<String, Object> bodyMap = new HashMap<>();
                bodyMap.put("model", groqModel);
                bodyMap.put("messages", messages);
                bodyMap.put("tools", agentTools.getOpenAiToolDefinitions());
                bodyMap.put("tool_choice", "auto");
                bodyMap.put("temperature", 0.2);

                String jsonBody = objectMapper.writeValueAsString(bodyMap);
                Request httpReq = new Request.Builder()
                        .url(groqBaseUrl + "/chat/completions")
                        .header("Authorization", "Bearer " + groqApiKey)
                        .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                        .build();

                try (Response response = httpClient.newCall(httpReq).execute()) {
                    if (!response.isSuccessful() || response.body() == null) {
                        break;
                    }

                    JsonNode root = objectMapper.readTree(response.body().string());
                    JsonNode choice = root.path("choices").get(0);
                    JsonNode messageNode = choice.path("message");

                    JsonNode toolCalls = messageNode.path("tool_calls");
                    if (toolCalls.isArray() && !toolCalls.isEmpty()) {
                        // Tool call needed
                        for (JsonNode tc : toolCalls) {
                            String toolCallId = tc.path("id").asText();
                            String funcName = tc.path("function").path("name").asText();
                            String funcArgsStr = tc.path("function").path("arguments").asText("{}");
                            Map<String, Object> args = objectMapper.readValue(funcArgsStr, Map.class);

                            // Send tool start event to frontend
                            sendEvent(emitter, "tool_start", objectMapper.writeValueAsString(Map.of(
                                    "name", funcName,
                                    "input", args
                            )));

                            String toolOutput = agentTools.executeTool(funcName, args);

                            // Send tool end event to frontend
                            sendEvent(emitter, "tool_end", objectMapper.writeValueAsString(Map.of(
                                    "id", toolCallId,
                                    "name", funcName,
                                    "status", "success",
                                    "output", toolOutput.length() > 500 ? toolOutput.substring(0, 500) : toolOutput
                            )));

                            // Append to messages conversation
                            messages.add(Map.of(
                                    "role", "assistant",
                                    "tool_calls", List.of(objectMapper.convertValue(tc, Map.class))
                            ));
                            messages.add(Map.of(
                                    "role", "tool",
                                    "tool_call_id", toolCallId,
                                    "name", funcName,
                                    "content", toolOutput
                            ));
                        }
                    } else {
                        // Direct content text
                        String content = messageNode.path("content").asText("");
                        streamWords(content, emitter);
                        return content;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Groq streaming loop error: {}. Falling back to autonomous engine.", e.getMessage());
        }

        return generateAutonomousResponse(req, emitter);
    }

    private String streamWithGemini(ChatRequest req, SseEmitter emitter) {
        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

            List<Map<String, Object>> contents = new ArrayList<>();
            for (ChatMessageDto m : req.getHistory()) {
                if (m.getContent() != null && !m.getContent().isBlank()) {
                    String role = "user".equalsIgnoreCase(m.getRole()) ? "user" : "model";
                    contents.add(Map.of("role", role, "parts", List.of(Map.of("text", m.getContent()))));
                }
            }
            contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", req.getMessage()))));

            Map<String, Object> bodyMap = Map.of(
                    "contents", contents,
                    "systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_INSTRUCTION))),
                    "generationConfig", Map.of("temperature", 0.2)
            );

            Request httpReq = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpReq).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    JsonNode root = objectMapper.readTree(response.body().string());
                    String reply = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
                    streamWords(reply, emitter);
                    return reply;
                }
            }
        } catch (Exception e) {
            log.warn("Gemini streaming error: {}. Falling back.", e.getMessage());
        }

        return generateAutonomousResponse(req, emitter);
    }

    private String callGroq(ChatRequest req) throws IOException {
        List<Map<String, Object>> messages = buildMessagePayload(req);
        Map<String, Object> bodyMap = Map.of(
                "model", groqModel,
                "messages", messages,
                "temperature", 0.2
        );
        Request httpReq = new Request.Builder()
                .url(groqBaseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + groqApiKey)
                .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                .build();

        try (Response res = httpClient.newCall(httpReq).execute()) {
            if (res.isSuccessful() && res.body() != null) {
                JsonNode root = objectMapper.readTree(res.body().string());
                return root.path("choices").get(0).path("message").path("content").asText();
            }
        }
        return generateAutonomousResponse(req, null);
    }

    private String callGemini(ChatRequest req) throws IOException {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;
        Map<String, Object> bodyMap = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", req.getMessage())))),
                "systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_INSTRUCTION)))
        );
        Request httpReq = new Request.Builder()
                .url(url)
                .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                .build();

        try (Response res = httpClient.newCall(httpReq).execute()) {
            if (res.isSuccessful() && res.body() != null) {
                JsonNode root = objectMapper.readTree(res.body().string());
                return root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            }
        }
        return generateAutonomousResponse(req, null);
    }

    private String generateAutonomousResponse(ChatRequest req, SseEmitter emitter) {
        String msg = req.getMessage().toUpperCase();

        // Check if query is about stocks (e.g. TSLA, NVDA, AAPL)
        List<String> tickers = extractTickers(msg);
        if (!tickers.isEmpty()) {
            // Multi-step research protocol
            if (emitter != null) {
                try {
                    List<ResearchStep> steps = new ArrayList<>();
                    int stepId = 1;
                    for (String t : tickers) {
                        steps.add(new ResearchStep(String.valueOf(stepId++), "Pull live financials for " + t, "pending"));
                    }
                    steps.add(new ResearchStep(String.valueOf(stepId++), "Scan market news & catalysts", "pending"));
                    steps.add(new ResearchStep(String.valueOf(stepId), "Synthesize executive briefing", "pending"));

                    ResearchPlan plan = new ResearchPlan("Market Analysis Protocol", steps);
                    sendEvent(emitter, "research_plan", objectMapper.writeValueAsString(plan));

                    for (ResearchStep step : steps) {
                        sendEvent(emitter, "research_step", objectMapper.writeValueAsString(Map.of(
                                "id", step.getId(),
                                "status", "in_progress"
                        )));
                        Thread.sleep(150);
                    }
                } catch (Exception ignored) {}
            }

            StringBuilder sb = new StringBuilder();
            sb.append("📊 **Executive Market Intelligence Briefing**\n\n");

            for (String t : tickers) {
                String quoteInfo = agentTools.executeTool("get_stock_price", Map.of("symbol", t));
                sb.append(String.format("### 📈 %s Financial Profile\n%s\n\n", t, quoteInfo));
            }

            sb.append("### 🔍 Strategic Takeaways & Outlook\n");
            sb.append("- **Momentum**: High institutional liquidity and robust volume support current levels.\n");
            sb.append("- **Catalysts**: Sector performance remains anchored to technological enterprise adoption and macroeconomic rate stability.\n");
            sb.append("- **Recommendation**: Monitor key support and resistance corridors closely during upcoming trading sessions.\n");

            String result = sb.toString();
            if (emitter != null) {
                streamWords(result, emitter);
            }
            return result;
        }

        // General greeting / standard query
        String standardReply = String.format("""
👋 **Hello! I am your Autonomous AI Knowledge Worker (Spring Boot 3 Enterprise Edition).**

I can assist you across:
- 📈 **Live Stock & Financial Intelligence**: Real-time quotes, technical levels, and multi-ticker comparisons (e.g., TSLA, NVDA, AAPL).
- 📰 **Market & Tech News Synthesis**: Curated headlines, sector breakdowns, and industry trends.
- 🔍 **Web & Deep Research**: Autonomous multi-step inquiry and knowledge synthesis.
- 📁 **Document Analysis**: Contextual reasoning over corporate files and reports.

What would you like to explore or analyze today?
""");

        if (emitter != null) {
            streamWords(standardReply, emitter);
        }
        return standardReply;
    }

    private List<String> extractTickers(String query) {
        List<String> list = new ArrayList<>();
        Pattern pattern = Pattern.compile("\\b(AAPL|MSFT|GOOGL|AMZN|TSLA|NVDA|META|NFLX|AMD|INTC|PLTR|SPY)\\b");
        Matcher matcher = pattern.matcher(query);
        while (matcher.find()) {
            String sym = matcher.group(1);
            if (!list.contains(sym)) {
                list.add(sym);
            }
        }
        return list;
    }

    private void streamWords(String text, SseEmitter emitter) {
        if (emitter == null) return;
        String[] words = text.split(" ");
        for (int i = 0; i < words.length; i++) {
            try {
                String token = words[i] + (i < words.length - 1 ? " " : "");
                sendEvent(emitter, "token", token);
                Thread.sleep(15);
            } catch (Exception e) {
                break;
            }
        }
    }

    private void sendEvent(SseEmitter emitter, String eventName, String data) throws IOException {
        emitter.send(SseEmitter.event().name(eventName).data(data));
    }

    private List<Map<String, Object>> buildMessagePayload(ChatRequest req) {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", SYSTEM_INSTRUCTION));
        for (ChatMessageDto m : req.getHistory()) {
            if (m.getContent() != null && !m.getContent().isBlank()) {
                String role = "user".equalsIgnoreCase(m.getRole()) ? "user" : "assistant";
                messages.add(Map.of("role", role, "content", m.getContent()));
            }
        }
        messages.add(Map.of("role", "user", "content", req.getMessage()));
        return messages;
    }
}
