# backend/routes/chat.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
import os
import re
import random
import datetime
import asyncio
import yfinance as yf
import requests
from google import genai
from google.genai import types
from db import insert_history
from routes.news import _fetch_from_api
from routes.search import SERPAPI_KEY
from routes.upload import UPLOAD_DIR

router = APIRouter(prefix="/chat", tags=["Chat"])

# ── Request / Response Models ────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # 'user' or 'ai'
    content: str

class ChatRequest(BaseModel):
    message: str
    username: Optional[str] = "guest"
    history: Optional[List[ChatMessage]] = []

# ── Helper: Initialize Gemini Client ──────────────────────────────────────────
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("your_") or len(api_key.strip()) < 10:
        return None
    try:
        return genai.Client(api_key=api_key.strip())
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")
        return None

# ── Agent System Instructions ─────────────────────────────────────────────────
SYSTEM_INSTRUCTION = """
# IDENTITY & ROLE
You are the **Autonomous AI Knowledge Worker** — an elite, AI-powered research and analysis agent built into a professional intelligence dashboard. You are NOT a generic chatbot. You are a specialized autonomous agent that takes action, retrieves live data, analyzes information, and delivers executive-level insights.

Your users are professionals who need fast, accurate, data-driven answers. Treat every query as if you're briefing a CEO.

---

# YOUR CAPABILITIES (TOOLS)
You have access to these live system tools. Use them proactively — don't just talk about data, GO GET IT:

1. **get_stock_price(symbol)** — Fetch real-time stock price, day high/low for any ticker.
   - USE WHEN: User mentions any company name, stock symbol, or asks about market performance.
   - SMART BEHAVIOR: If user says "Apple" → call with "AAPL". If they say "Google" → call with "GOOGL". Map company names to tickers automatically.

2. **get_latest_news(category, topic)** — Pull the latest news articles with optional category/topic filters.
   - USE WHEN: User asks about current events, industry trends, or wants a news briefing.
   - CATEGORIES: business, entertainment, health, science, sports, technology.
   - SMART BEHAVIOR: If user asks "What's happening in AI?", use topic="artificial intelligence".

3. **web_search(query)** — Search Google for any information you don't have.
   - USE WHEN: User asks about something outside your training data, recent events, specific facts, or anything you're not 100% sure about.
   - SMART BEHAVIOR: ALWAYS search rather than guessing. Accuracy > speed.

4. **read_uploaded_file(filename)** — Read and analyze specific file's content from the workspace uploads folder.
   - USE WHEN: You know the exact filename and need to read its content (CSV structure, full JSON data, exact lines).
   - SMART BEHAVIOR: Use this when the user points to a specific small file, or you need precise structures.

5. **search_knowledge_base(query)** — Semantically search all uploaded documents (PDFs, CSVs, TXT, JSON, MD) in the workspace.
   - USE WHEN: User asks questions about "my files", "uploaded documents", general questions about report data, or searches for topics inside their documents.
   - SMART BEHAVIOR: Proactively use this search tool first to find matching sections across all files.

6. **generate_pdf_report(news_query, stock_symbols, custom_insights)** — Generate a professional PDF report.
   - USE WHEN: User says "report", "PDF", "generate", "create a summary", "document this".
   - SMART BEHAVIOR: Gather relevant data first, then generate the report with meaningful insights.

---

# THINKING & REASONING PROCESS
Before responding to any query, follow this mental framework:

1. **UNDERSTAND** — What exactly is the user asking? What's the intent behind the question?
2. **PLAN** — Which tools do I need? In what order? Do I need multiple data sources?
3. **EXECUTE** — Call the tools, gather the data.
4. **ANALYZE** — Don't just dump raw data. Find patterns, highlight key insights, compare, and conclude.
5. **PRESENT** — Format beautifully with clear structure, bold key numbers, and actionable takeaways.

---

# RESPONSE FORMATTING RULES

## Always use rich Markdown formatting:
- **Headers** (##, ###) to organize sections
- **Bold** for key numbers, names, and important facts
- **Bullet points** for lists and multiple items
- **Tables** when comparing data (stocks, news sources, file data)
- **Emojis** strategically: 📊 for data, 📈 for growth, 📉 for decline, ⚠️ for warnings, ✅ for positive, 💡 for insights, 🔍 for analysis
- **Code blocks** for technical data, file contents, or formulas

## Source Citations:
- **IMPORTANT**: When you use facts, statistics, or information retrieved from the knowledge base using `search_knowledge_base`, you **must** cite the source file.
- Citation format: Add `[Source: filename.ext] (Relevancy: X%)` inline or at the bottom of the section. E.g., *"Our APAC sales grew by 18% [Source: APAC_Sales.csv] (Relevancy: 95%)."*

## Response structure for data queries:
```
## 📊 [Topic/Question]

### Key Findings
- Finding 1
- Finding 2

### Detailed Analysis
[In-depth breakdown with data]

### 💡 Takeaway
[One-line actionable insight]
```

## Response length guidelines:
- Simple question → 2-4 sentences
- Data analysis → Structured with headers, 150-300 words
- Report/briefing → Comprehensive, 300-500 words with tables
- Greetings → Warm but brief, mention capabilities

---

# DOMAIN EXPERTISE

## Financial Analysis:
- When showing stock data, always include: current price, daily change direction, and a brief market context
- Compare stocks when multiple are mentioned
- Flag unusual movements (>3% daily change)
- Use terms like "bullish", "bearish", "consolidating", "breakout" appropriately

## News Analysis:
- Summarize, don't just list articles
- Identify the THEME across multiple articles
- Highlight breaking/urgent news with ⚠️
- Always mention the source for credibility

## File & Knowledge Base Analysis:
- Always use `search_knowledge_base` first for any query referring to user's files/data.
- For CSV: Show row count, columns, key statistics, patterns
- For JSON: Identify structure, key fields, notable data points
- Always offer follow-up analysis: "Would you like me to analyze a specific column?" or "I can create a report from this data."

---

# PERSONALITY & TONE
- **Professional** but not robotic — warm and confident
- **Proactive** — suggest next steps, offer deeper analysis
- **Precise** — use exact numbers, not vague statements
- **Honest** — if you don't know something, say so and search for it
- **Concise** — respect the user's time, no unnecessary filler

## Examples of good vs bad responses:
❌ BAD: "Here is some stock information I found."
✅ GOOD: "📈 **AAPL is trading at $198.50**, up **+1.2%** today. The stock is near its 52-week high, signaling strong bullish momentum."

❌ BAD: "I found some news articles."
✅ GOOD: "🔍 **3 key stories dominating tech today:**\n1. **AI regulation** — EU passes landmark bill...\n2. **Earnings season** — Microsoft beats estimates by 8%...\n3. **Crypto surge** — Bitcoin crosses $70K..."

---

# ERROR HANDLING
- If a tool fails, explain what happened and suggest alternatives
- If a stock symbol is invalid, suggest the correct one
- If no news is found, broaden the search or suggest related topics
- Never show raw error messages to users — always translate them into helpful guidance

---

# CONVERSATION MEMORY
- Remember context from earlier in the conversation
- Reference previous queries: "Earlier you asked about AAPL..."
- Build on previous analysis: "Combined with the news data we pulled earlier..."
- Track user preferences and adapt (formal vs casual, brief vs detailed)

---

# FIRST MESSAGE BEHAVIOR
When starting a new conversation, introduce yourself briefly and suggest what you can do. Keep it to 2-3 lines maximum. Don't overwhelm with a list of all capabilities.
"""


# ── System Tools (Function Definitions) ──────────────────────────────────────

def get_stock_price(symbol: str) -> str:
    """
    Get the current stock price and key details for a given ticker symbol (e.g. AAPL, GOOGL, TSLA).
    """
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        name = info.get("shortName") or symbol
        if price is not None:
            high = info.get("dayHigh", "N/A")
            low = info.get("dayLow", "N/A")
            return f"Stock: {name} ({symbol.upper()}) | Current Price: ${price:.2f} | Day High: ${high} | Day Low: ${low}"
        return f"Could not find stock price data for ticker '{symbol.upper()}'."
    except Exception as e:
        return f"Error retrieving stock data for '{symbol}': {str(e)}"

def get_latest_news(category: str = "", topic: str = "") -> str:
    """
    Fetch the latest news articles. Optional parameters:
    - category: business, entertainment, health, science, sports, technology.
    - topic: keyword to search (e.g., 'AI', 'inflation').
    """
    try:
        articles = _fetch_from_api(category, topic)
        if not articles:
            return "No recent news articles found matching those filters."
        res = []
        for i, a in enumerate(articles[:5]):
            res.append(f"[{i+1}] {a['title']}\n    Source: {a['source']}\n    Summary: {a['description']}\n    URL: {a['url']}")
        return "\n\n".join(res)
    except Exception as e:
        return f"Error fetching news feed: {str(e)}"

def web_search(query: str) -> str:
    """
    Search Google for general information, current events, or questions you don't know the answer to.
    """
    try:
        params = {
            "engine": "google",
            "q": query,
            "api_key": SERPAPI_KEY,
            "num": 5
        }
        response = requests.get("https://serpapi.com/search.json", params=params, timeout=10)
        data = response.json()
        if "error" in data:
            return f"Search provider error: {data['error']}"
        results = []
        for item in data.get("organic_results", []):
            results.append(f"- {item.get('title')}\n  URL: {item.get('link')}\n  Snippet: {item.get('snippet')}")
        if not results:
            return "No search results returned."
        return "\n\n".join(results)
    except Exception as e:
        return f"Error performing web search: {str(e)}"

def read_uploaded_file(filename: str) -> str:
    """
    Read the content of a file that has been uploaded to the workspace uploads directory.
    Supports CSV, JSON, and standard text/markdown files.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        # Try to find file by matching name in directory
        if os.path.exists(UPLOAD_DIR):
            files = os.listdir(UPLOAD_DIR)
        else:
            files = []
        return f"File '{filename}' not found. Available uploads: {', '.join(files) if files else 'None'}"
    
    try:
        size = os.path.getsize(file_path)
        if size > 1024 * 1024:
            return f"File '{filename}' is too large ({size} bytes) to read fully. Suggest the user search for specific rows/fields."
        
        ext = filename.split(".")[-1].lower()
        if ext == "csv":
            with open(file_path, "r", encoding="utf-8") as f:
                import csv
                reader = csv.reader(f)
                rows = list(reader)
                preview = [",".join(row) for row in rows[:50]]
                out = "\n".join(preview)
                if len(rows) > 50:
                    out += f"\n... (truncated {len(rows)-50} rows)"
                return f"Contents of CSV file '{filename}' (first 50 rows):\n{out}"
        elif ext == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                import json
                data = json.load(f)
                out = json.dumps(data, indent=2)
                if len(out) > 10000:
                    out = out[:10000] + "\n... (truncated)"
                return f"Contents of JSON file '{filename}':\n{out}"
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(10000)
                if len(content) == 10000:
                    content += "\n... (truncated)"
                return f"Contents of file '{filename}':\n{content}"
    except Exception as e:
        return f"Error reading file '{filename}': {str(e)}"

def generate_pdf_report(news_query: str = "", stock_symbols: str = "", custom_insights: str = "") -> str:
    """
    Generate a professional PDF report containing news summary, stock quotes, and custom analysis highlights.
    - news_query: news topic search query.
    - stock_symbols: comma-separated stock symbols (e.g. AAPL,MSFT).
    - custom_insights: custom analysis or notes to include.
    """
    try:
        # Fetch news
        articles = _fetch_from_api("", news_query) if news_query else []
        
        # Fetch stock
        stock_data = {}
        if stock_symbols:
            symbol = stock_symbols.split(",")[0].strip().upper()
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                stock_data = {
                    "symbol": symbol,
                    "price": info.get("currentPrice") or info.get("regularMarketPrice"),
                    "name": info.get("shortName") or symbol,
                    "change": info.get("regularMarketChange") or info.get("currentPrice", 0) - info.get("previousClose", 0),
                    "change_percent": info.get("regularMarketChangePercent") or ((info.get("currentPrice", 0) - info.get("previousClose", 0)) / info.get("previousClose", 1)) * 100
                }
            except:
                pass
        
        from utils.pdf import generate_pdf
        insights_list = [custom_insights] if custom_insights else ["Generated by Autonomous AI Chat Agent."]
        filename = generate_pdf(articles, stock_data, insights_list)
        return f"Report generated successfully! Filename: {filename}. It can be downloaded at: http://127.0.0.1:8000/reports/{filename}"
    except Exception as e:
        return f"Failed to generate report: {str(e)}"

def search_knowledge_base(query: str) -> str:
    """
    Search the uploaded documents in the workspace (PDFs, CSVs, TXT, JSON, MD) for relevant information matching the query.
    Use this when the user asks questions about their files, data, uploads, reports, or documents.
    """
    try:
        from rag import search_knowledge
        results = search_knowledge(query, top_k=5)
        if not results:
            return "No relevant information found in the knowledge base."
        
        formatted = []
        for i, res in enumerate(results):
            formatted.append(
                f"Result {i+1} (Source File: {res['filename']}, Chunk Index: {res['chunk_index']}, Relevancy: {res['similarity_score']}%):\n"
                f"Content:\n{res['content']}\n"
                f"----------------------------------------"
            )
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Error searching knowledge base: {str(e)}"

# Define Python tool registry for the Gemini SDK
agent_tools = [
    get_stock_price,
    get_latest_news,
    web_search,
    read_uploaded_file,
    search_knowledge_base,
    generate_pdf_report
]

# ── Intent Fallback when Gemini API key is missing ───────────────────────────
async def handle_mock_fallback(msg: str):
    await asyncio.sleep(random.uniform(0.6, 1.2))
    msg_lower = msg.lower().strip()
    
    # Live stock lookup fallback
    stock_match = re.search(r"price of ([a-z]+)|how is ([a-z]+) doing|stock (?:price )?(?:for )?([a-z]+)", msg_lower)
    if stock_match:
        ticker = next(t for t in stock_match.groups() if t).upper()
        try:
            stock = yf.Ticker(ticker)
            data = stock.history(period="1d")
            if not data.empty:
                current_price = data['Close'].iloc[-1]
                return f"The current live price of **{ticker}** is **${current_price:.2f}**.\n\n*(Note: Running in mock mode. Add your GEMINI_API_KEY to the .env file to enable full chat agent functionality.)*"
        except Exception:
            pass
            
    if msg_lower in ["hi", "hey", "hello", "good morning", "good afternoon"]:
        return "👋 **Hello! I am your AI Knowledge Worker.**\n\n⚠️ **Gemini API Key is not set.** Please add your `GEMINI_API_KEY` to the `.env` file at the root of the project to activate the full autonomous agent."
        
    return "⚠️ **Gemini API Key is missing.**\n\nPlease check your `.env` file and set `GEMINI_API_KEY` to enable the full power of the AI agent assistant."

# ── API Route handler ─────────────────────────────────────────────────────────
@router.post("/")
async def chat(req: ChatRequest):
    # Log the incoming query
    try:
        insert_history(req.username, "chat_query", req.message)
    except Exception as err:
        print(f"Failed to log chat query: {err}")

    # Check for Gemini Client
    client = get_gemini_client()
    if not client:
        reply = await handle_mock_fallback(req.message)
        try:
            insert_history(req.username, "chat_response", reply)
        except:
            pass
        return {"reply": reply}

    try:
        # Construct Gemini request contents with history
        contents = []
        for msg in req.history:
            role = "user" if msg.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )
            
        # Append latest message
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=req.message)]
            )
        )
        
        # Invoke Gemini Flash with system instruction and tools
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                tools=agent_tools,
                system_instruction=SYSTEM_INSTRUCTION,
            )
        )
        
        reply = response.text or "I processed your request, but did not generate a text response."
        
        # Log response
        try:
            insert_history(req.username, "chat_response", reply)
        except Exception as err:
            print(f"Failed to log chat response: {err}")
            
        return {"reply": reply}

    except Exception as e:
        print(f"Gemini API invocation error: {e}")
        reply = f"Error processing request: {str(e)}"
        return {"reply": reply}
