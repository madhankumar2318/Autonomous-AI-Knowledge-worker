# backend/routes/report.py
import os
from fastapi import APIRouter
from typing import Optional
import yfinance as yf
from utils.summarizer import summarize
from utils.pdf import generate_pdf
from routes.news import _fetch_from_api
from db import insert_report
import json

router = APIRouter(prefix="/report", tags=["Report"])

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "reports")

@router.post("/")
def generate_report(
    news: Optional[list] = None,
    stock: Optional[dict] = None,
    insights: Optional[list] = None,
):
    """
    Generate a PDF report from news, stock and insights data.
    If parameters are omitted, it autonomously fetches the latest news, AAPL stock quote,
    and uses Gemini to generate smart analysis highlights.
    """
    # ── Fetch default news if empty ──
    if not news:
        try:
            news = _fetch_from_api("", "")  # latest news country='us'
        except Exception as e:
            print(f"Auto-report news fetch error: {e}")
            news = []

    # ── Fetch default stock if empty ──
    if not stock:
        try:
            ticker = yf.Ticker("AAPL")
            info = ticker.info
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            change = info.get("regularMarketChange") or 0.0
            change_pct = info.get("regularMarketChangePercent") or 0.0
            stock = {
                "symbol": "AAPL",
                "name": info.get("shortName") or "Apple Inc.",
                "price": price,
                "change": change,
                "change_percent": change_pct
            }
        except Exception as e:
            print(f"Auto-report stock fetch error: {e}")
            stock = {}

    # ── Fetch default insights if empty ──
    if not insights:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and not api_key.startswith("your_") and len(api_key.strip()) > 10:
            try:
                from google import genai
                client = genai.Client(api_key=api_key.strip())
                
                stock_summary = f"Stock: {stock.get('name')} ({stock.get('symbol')}) current price is ${stock.get('price'):.2f}." if stock.get('price') else ""
                news_summary = "\n".join([f"- {a.get('title')}: {a.get('description')}" for a in news[:3]])
                
                prompt = (
                    "Based on the following stock and news data, generate exactly 3 concise, professional business insight bullets. "
                    "Make sure they are informative and realistic. Return ONLY the bullet points, one per line (without bullet characters):\n\n"
                    f"{stock_summary}\n\nNews:\n{news_summary}"
                )
                
                response = None
                for model_name in ["gemini-2.5-flash", "gemini-2.0-flash"]:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=prompt
                        )
                        if response and response.text:
                            break
                    except Exception as ex:
                        print(f"Failed to generate insights using {model_name}: {ex}")
                
                if response and response.text:
                    insights = [line.strip().lstrip("•-* ") for line in response.text.strip().split("\n") if line.strip()]
            except Exception as e:
                print(f"Auto-report insights generation error: {e}")
        
        # Fallback if Gemini key is missing or call fails
        if not insights:
            insights = [
                "Market indices exhibit consolidated trading ranges with tech shares showing mild volatility.",
                "Latest global headlines emphasize ongoing supply chain adjustments and interest rate projections.",
                "AI sector development remains a central catalyst driving market sentiment and technical analysis."
            ]

    # Combine news descriptions for the summarizer
    news_text = ""
    if news:
        news_text = "\n".join([f"{a.get('title', '')}. {a.get('description', '')}" for a in news if a])

    summary = summarize(news_text, max_sentences=3)
    filename = generate_pdf(news, stock, insights)
    
    try:
        insert_report(
            news=json.dumps(news),
            stock=json.dumps(stock),
            insights=json.dumps(insights)
        )
    except Exception as db_err:
        print(f"Error inserting report to DB: {db_err}")
        
    return {
        "message": "Report generated successfully",
        "summary": summary,
        "file": filename,
        "url": f"http://127.0.0.1:8000/reports/{filename}"
    }

@router.get("/list")
def list_reports():
    """
    List all generated PDF reports from the reports static directory.
    """
    if not os.path.exists(REPORTS_DIR):
        return {"reports": []}
    
    files = []
    try:
        for f in os.listdir(REPORTS_DIR):
            if f.lower().endswith(".pdf"):
                full_path = os.path.join(REPORTS_DIR, f)
                stat = os.stat(full_path)
                files.append({
                    "filename": f,
                    "url": f"http://127.0.0.1:8000/reports/{f}",
                    "size": stat.st_size,
                    "created_at": stat.st_mtime
                })
        # Newest first
        files.sort(key=lambda x: x["created_at"], reverse=True)
    except Exception as e:
        print(f"Error listing reports: {e}")
        
    return {"reports": files}
