# Autonomous AI Knowledge Worker — Spring Boot 3 Backend

Enterprise **Java Full Stack** backend built with **Spring Boot 3.3.4** and **Java 17 LTS**.

---

## 🚀 Key Features & Architecture

- **Framework**: Spring Boot 3.3.4 on Java 17 LTS.
- **Security & Authentication**: Spring Security 6 with stateless JWT Bearer filters (`io.jsonwebtoken`), BCrypt password hashing, and refresh token rotation.
- **Data Persistence**: Spring Data JPA & Hibernate with HikariCP connection pooling (PostgreSQL ready, local dev database auto-configured).
- **Autonomous AI Agent**:
  - Multi-step reasoning and function calling for financial and news analysis.
  - Dual-LLM engine supporting **Groq (Ultra-Fast)** (`openai/gpt-oss-120b`) and **Google Gemini 2.5** (`gemini-2.5-flash`).
  - Autonomous tools:
    - `get_stock_price(symbol)`: Live financial metrics and Yahoo Finance quotes.
    - `get_latest_news(category, topic)`: Real-time market news and sector headlines.
    - `web_search(query)`: Deep web and corporate knowledge discovery.
- **Real-Time Streaming**: Server-Sent Events (SSE) via Spring MVC `SseEmitter` (`POST /chat/stream`) emitting real-time tokens, tool executions, research steps, and model identification.
- **Live Visuals**: Spring WebSocket (`/ws/live`) broadcasting market tick updates to dashboard charts.
- **Full Stack Compatibility**: 100% API contract parity with the existing Next.js frontend.

---

## 🛠️ Requirements & Tech Stack

- **Java**: JDK 17 LTS or newer.
- **Build Tool**: Apache Maven 3.9+.
- **Frontend**: Next.js 15 (React 19 / TypeScript).

---

## 🏃 Running the Application

### 1. Build and Run via Maven
```bash
cd backend-spring
mvn clean spring-boot:run
```

### 2. Run with Custom API Keys
```bash
java -DGROQ_API_KEY="your_groq_key" -DGEMINI_API_KEY="your_gemini_key" -jar target/backend-spring-1.0.0.jar
```

The server will launch on port `8080`:
- Root check: `http://localhost:8080/`
- Health check: `http://localhost:8080/db/status`

---

## 🔌 Connecting Next.js Frontend

In `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```
Then run:
```bash
cd frontend
npm run dev
```

---

## 📡 REST API Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Health and service greeting |
| `GET` | `/db/status` | Database connection status |
| `POST` | `/auth/register` | User registration with JWT generation |
| `POST` | `/auth/login` | User authentication |
| `GET` | `/auth/verify` | Token verification |
| `POST` | `/auth/logout` | Session teardown |
| `GET` | `/chat/threads` | List conversation threads |
| `POST` | `/chat/threads` | Create new conversation thread |
| `GET` | `/chat/threads/{id}/messages` | Retrieve thread messages |
| `POST` | `/chat/` | Synchronous AI Agent chat |
| `POST` | `/chat/stream` | Real-time SSE streaming chat with tool calls |
| `GET` | `/stock/?symbol=...` | Live financial quote |
| `GET` | `/stock/multiple` | Watchlist batch quotes |
| `GET` | `/news` | Market & tech news headlines |
| `GET` | `/search` | Web & knowledge search |
| `GET` | `/upload/list` | Uploaded file catalog |
| `WS` | `/ws/live` | WebSocket live market stream |
