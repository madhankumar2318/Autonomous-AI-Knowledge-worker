# Autonomous AI Knowledge Worker — Java Full Stack Edition

An enterprise **Java Full Stack** application featuring an autonomous AI knowledge worker capable of real-time financial market intelligence, multi-ticker stock analysis, live news synthesis, and conversational document reasoning.

Built with a **Spring Boot 3 (Java 17 LTS)** backend and a **Next.js 15 (React 19 / TypeScript)** frontend.

---

## 🏗️ Architecture & Tech Stack

### ☕ Backend (`backend-spring/`)
- **Runtime**: Java 17 LTS
- **Framework**: Spring Boot 3.3.4 (Spring MVC, Spring WebSocket)
- **Security & Auth**: Spring Security 6, JJWT (`0.12.6`), stateless Bearer token authentication, BCrypt password encryption, refresh token rotation
- **Persistence**: Spring Data JPA & Hibernate with HikariCP connection pooling
- **AI Agent & LLM Engine**:
  - Autonomous function calling tools: `get_stock_price`, `get_latest_news`, `web_search`
  - Dual-model support: **Groq (Ultra-Fast)** (`openai/gpt-oss-120b`) and **Google Gemini 2.5** (`gemini-2.5-flash`)
- **Real-Time Streaming**: Server-Sent Events (SSE) via `SseEmitter` (`POST /chat/stream`)
- **Live Visuals**: Spring WebSocket (`/ws/live`) broadcasting market tick updates

### ⚛️ Frontend (`frontend/`)
- **Framework**: Next.js 15 (App Router, Turbopack)
- **UI Library**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Features**: Dual-model selector, Cmd+K command palette, Markdown & LaTeX math rendering, multi-threaded chat history, interactive stock charts, live market feeds

---

## 📁 Project Structure

```
├── backend-spring/           # Spring Boot 3 Java Backend
│   ├── pom.xml               # Maven configuration (Java 17 LTS)
│   ├── src/main/java/com/knowledge/worker/
│   │   ├── config/           # SecurityConfig, CorsConfig, JwtAuthFilter, WebSocketConfig
│   │   ├── controller/       # REST Controllers (Auth, Chat, Threads, Stock, News, Search, Upload)
│   │   ├── dto/              # Strongly-typed Data Transfer Objects
│   │   ├── entity/           # JPA Entities (User, ChatThread, ChatMessage, TokenUsage, etc.)
│   │   ├── repository/       # Spring Data JPA Repositories
│   │   ├── service/          # Business logic, AuthService, AgentService, StockService, etc.
│   │   └── tools/            # Autonomous Agent tools (@Tool definitions)
│   └── src/main/resources/application.yml
│
└── frontend/                 # Next.js 15 Frontend
    ├── app/                  # App Router pages and components
    ├── hooks/                # useChatStream (SSE streaming hook)
    ├── package.json          # Node dependencies
    └── app/config.ts         # API base URL configuration (defaults to port 8080)
```

---

## 🚀 Getting Started

### 1. Start the Spring Boot Backend

Ensure you have **Java 17 LTS** and **Maven 3.9+** installed.

```bash
cd backend-spring
mvn clean spring-boot:run
```

The Spring Boot backend will start on **`http://localhost:8080`**:
- Health check: `http://localhost:8080/db/status`
- Root test: `http://localhost:8080/`

### 2. Start the Frontend

Ensure you have **Node.js 18+** installed.

```bash
cd frontend
npm install
npm run dev
```

The application will be available at **`http://localhost:3000`** and connects automatically to the Spring Boot backend on port `8080`.

---

## 🔑 Environment Configuration

In `backend-spring/.env` (or pass via system properties / environment variables):
```env
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 🧪 Testing & Verification

- **Backend Unit Tests**:
  ```bash
  cd backend-spring
  mvn test
  ```
- **Package Executable JAR**:
  ```bash
  cd backend-spring
  mvn clean package -DskipTests
  java -jar target/backend-spring-1.0.0.jar
  ```
- **Frontend Build Verification**:
  ```bash
  cd frontend
  npm run build
  ```
