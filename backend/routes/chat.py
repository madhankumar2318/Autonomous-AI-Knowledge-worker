from fastapi import APIRouter
from pydantic import BaseModel
import asyncio
import random
import re
import datetime
import yfinance as yf
from routes.news import get_news

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
async def chat(req: ChatRequest):
    msg = req.message.lower().strip()
    
    # Simulate thinking delay to make the UI look realistic
    await asyncio.sleep(random.uniform(0.6, 1.3))
    
    # ==========================================
    # INTENT 1: LIVE STOCK PRICE LOOKUP
    # ==========================================
    stock_match = re.search(r"price of ([a-z]+)|how is ([a-z]+) doing|stock (?:price )?(?:for )?([a-z]+)", msg)
    if stock_match:
        ticker = next(t for t in stock_match.groups() if t).upper()
        try:
            stock = yf.Ticker(ticker)
            data = stock.history(period="1d")
            if not data.empty:
                current_price = data['Close'].iloc[-1]
                return {"reply": f"The current live price of **{ticker}** is **${current_price:.2f}**."}
            else:
                return {"reply": f"I couldn't fetch live data for {ticker}. Are you sure that's a valid stock symbol?"}
        except Exception:
            return {"reply": f"There was an error pulling the live ticker data for {ticker}."}

    # ==========================================
    # INTENT 2: LIVE NEWS LOOKUP
    # ==========================================
    if "news" in msg or "headlines" in msg or "what's happening" in msg:
        try:
            news_data = get_news()
            articles = news_data.get("news", [])
            if articles:
                # Grab the top 2 headlines
                top_1 = articles[0]['title']
                top_2 = articles[1]['title'] if len(articles) > 1 else ""
                reply = f"Here is what's happening right now:\n1. {top_1}\n"
                if top_2: reply += f"2. {top_2}\n"
                reply += "\nYou can read the full articles in the Latest News panel on your left!"
                return {"reply": reply}
            else:
                return {"reply": "I tried to fetch the news, but the API returned no articles at the moment."}
        except Exception as e:
            return {"reply": "I'm having trouble connecting to the live news feed right now."}

    # ==========================================
    # INTENT 3: TIME & DATE AWARENESS
    # ==========================================
    if "time" in msg or "clock" in msg:
        current_time = datetime.datetime.now().strftime("%I:%M %p")
        return {"reply": f"It is exactly {current_time} local time."}
    if "date" in msg or "day is it" in msg:
        current_date = datetime.datetime.now().strftime("%B %d, %Y")
        return {"reply": f"Today is {current_date}."}

    # ==========================================
    # INTENT 4: GREETINGS & SMALL TALK
    # ==========================================
    if msg in ["hi", "hey", "hello", "good morning", "good afternoon"]:
        hour = datetime.datetime.now().hour
        greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
        return {"reply": f"{greeting}! I am your Autonomous Knowledge Worker. I can check live stock prices (try saying 'price of AAPL') or fetch the latest news!"}
        
    if "who are you" in msg or "what are you" in msg:
        return {"reply": "I am a local Autonomous AI. I run directly within your dashboard and possess live integrations with your system's data feeds without relying on external tracked LLMs!"}
        
    if "joke" in msg:
        jokes = [
            "Why did the stock market go to school? To improve its indexing!",
            "I asked a database administrator for a joke. He said he would get back to me, but he dropped the table.",
            "Why do programmers prefer dark mode? Because light attracts bugs!"
        ]
        return {"reply": random.choice(jokes)}

    # ==========================================
    # INTENT 5: GENERIC DASHBOARD FEATURES
    # ==========================================
    if "report" in msg:
        return {"reply": "I can certainly help with reports! You can generate a full data report by clicking the 'Report' button in the top right corner of the dashboard."}
    if "market" in msg:
        return {"reply": "The market is constantly shifting. You can use the Stock Market widget on the right to see live prices of over 40 major tickers!"}

    # ==========================================
    # FALLBACK INTENT
    # ==========================================
    responses = [
        "That's an interesting point. Let me pull up some relevant data on the dashboard for you.",
        "I'm operating entirely locally right now! Try asking me for the latest news or a specific stock price like 'price of TSLA'.",
        "I see! I'll index that information in my working memory for our session.",
        "Could you elaborate? I want to make sure I fetch exactly what you're looking for from our data streams."
    ]
    return {"reply": random.choice(responses)}

