import requests
import time
import os
from urllib.parse import quote as url_quote
from fastapi import APIRouter, Query
from db import insert_history

router = APIRouter(prefix="/news", tags=["News"])

# ── Currents API config ────────────────────────────────────────────────
PAGE_SIZE    = 50    # fetch max articles per API call (Currents API max for Free tier is 50)
PER_PAGE     = 20    # articles served per page to the frontend
CACHE_TTL    = 1800  # 30 minutes

# ── Multi-key cache: {cache_key: {"data": [...], "timestamp": float}} ──
_cache: dict[str, dict] = {}


def _make_cache_key(category: str, topic: str) -> str:
    return f"{category.strip().lower()}|{topic.strip().lower()}"


def _fetch_from_api(category: str, topic: str) -> list[dict]:
    """
    Fetch articles from Currents News API:
      - If topic (keywords) is provided, query /v1/search
      - Otherwise, query /v1/latest-news
    """
    api_key = os.getenv("CURRENTS_API_KEY")
    if not api_key or api_key == "your_currents_api_key_here":
        print("⚠️ Currents API Key is not set or is still the placeholder. Please set CURRENTS_API_KEY in your .env file.")
        return []

    try:
        headers = {
            "Authorization": api_key
        }
        params = {
            "language": "en",
            "page_size": PAGE_SIZE,
        }

        if topic.strip():
            url = "https://api.currentsapi.services/v1/search"
            params["keywords"] = topic.strip()
        else:
            url = "https://api.currentsapi.services/v1/latest-news"
            params["country"] = "us"  # default to US latest news

        if category.strip():
            params["category"] = category.strip().lower()

        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"Currents API error response code: {response.status_code} | text: {response.text}")
            return []

        data = response.json()

        if data.get("status") == "ok":
            articles = data.get("news", [])
            clean = [
                {
                    "title":       a.get("title"),
                    "description": a.get("description") or "",
                    "url":         a.get("url"),
                    "urlToImage":  a.get("image"),
                    "publishedAt": a.get("published"),
                    "source":      a.get("author") or a.get("source") or "",
                }
                for a in articles
            ]
            # Log to history separately — don't let a DB error kill the fetch
            try:
                insert_history("system", "news_fetch", f"Fetched {len(clean)} articles (category={category}, topic={topic})")
            except Exception as log_err:
                print(f"History log error (non-fatal): {log_err}")
            return clean
        else:
            print(f"Currents API status error: {data}")
            return []
    except Exception as e:
        print(f"News fetch exception: {e}")
        return []


@router.get("/")
def get_news(
    page:     int = Query(1,  ge=1,  description="Page number (1-based)"),
    category: str = Query("", description="NewsAPI category: business, sports, technology, etc."),
    topic:    str = Query("", description="Free-text keyword search"),
):
    """
    Return paginated news articles with optional category and keyword filters.
    Articles are fetched from NewsAPI and cached for 30 minutes per unique query.
    """
    global _cache
    now       = time.time()
    cache_key = _make_cache_key(category, topic)

    # Refresh cache if stale or empty
    if cache_key not in _cache or (now - _cache[cache_key]["timestamp"]) > CACHE_TTL or not _cache[cache_key]["data"]:
        articles = _fetch_from_api(category, topic)
        _cache[cache_key] = {"data": articles, "timestamp": now}

    all_articles = _cache[cache_key]["data"]

    # Paginate: slice the cached list
    start = (page - 1) * PER_PAGE
    end   = start + PER_PAGE
    page_articles = all_articles[start:end]

    return {
        "news":       page_articles,
        "total":      len(all_articles),
        "page":       page,
        "per_page":   PER_PAGE,
        "has_more":   end < len(all_articles),
    }
