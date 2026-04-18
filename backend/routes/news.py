import requests
import time
from urllib.parse import quote as url_quote
from fastapi import APIRouter, Query
from db import insert_history

router = APIRouter(prefix="/news", tags=["News"])

# ── NewsAPI config ─────────────────────────────────────────────────────
NEWS_API_KEY = "061a9915bd56414f9075c98eeab90949"
PAGE_SIZE    = 100   # fetch max articles per API call (NewsAPI max is 100)
PER_PAGE     = 20    # articles served per page to the frontend
CACHE_TTL    = 1800  # 30 minutes

# ── Multi-key cache: {cache_key: {"data": [...], "timestamp": float}} ──
_cache: dict[str, dict] = {}


def _make_cache_key(category: str, topic: str) -> str:
    return f"{category.strip().lower()}|{topic.strip().lower()}"


def _fetch_from_api(category: str, topic: str) -> list[dict]:
    """
    Choose the right NewsAPI endpoint based on params:
      - topic provided  → /everything  (full-text keyword search, any source)
      - category only   → /top-headlines?category=
      - nothing         → /top-headlines?country=us
    Always request pageSize=100 for maximum articles.
    """
    try:
        if topic.strip():
            # Full-text search across all sources worldwide
            url = (
                f"https://newsapi.org/v2/everything"
                f"?q={url_quote(topic)}"
                f"&language=en"
                f"&sortBy=publishedAt"
                f"&pageSize={PAGE_SIZE}"
                f"&apiKey={NEWS_API_KEY}"
            )
        elif category.strip():
            # Category filter on US top-headlines
            url = (
                f"https://newsapi.org/v2/top-headlines"
                f"?country=us"
                f"&category={category.strip().lower()}"
                f"&pageSize={PAGE_SIZE}"
                f"&apiKey={NEWS_API_KEY}"
            )
        else:
            # Default: US top-headlines, maximum count
            url = (
                f"https://newsapi.org/v2/top-headlines"
                f"?country=us"
                f"&pageSize={PAGE_SIZE}"
                f"&apiKey={NEWS_API_KEY}"
            )

        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("status") == "ok":
            articles = data.get("articles", [])
            # Filter out removed/hidden articles
            articles = [
                a for a in articles
                if a.get("title") and "[Removed]" not in a.get("title", "")
            ]
            clean = [
                {
                    "title":       a.get("title"),
                    "description": a.get("description") or "",
                    "url":         a.get("url"),
                    "urlToImage":  a.get("urlToImage"),
                    "publishedAt": a.get("publishedAt"),
                    "source":      a.get("source", {}).get("name", ""),
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
            print(f"NewsAPI error response: {data.get('message')} | code: {data.get('code')}")
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
