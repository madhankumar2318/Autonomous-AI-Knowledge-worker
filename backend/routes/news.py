import requests
import time
import os
from urllib.parse import quote as url_quote
from fastapi import APIRouter, Query
from db import insert_history

router = APIRouter(prefix="/news", tags=["News"])

# ── Currents API config ────────────────────────────────────────────────
API_PAGE_SIZE = 50    # articles per API call (Free tier max = 50)
MAX_PAGES     = 4     # number of API pages to fetch (4 × 50 = 200 articles max)
PER_PAGE      = 100   # articles served per page to the frontend
CACHE_TTL     = 1800  # 30 minutes

# ── Multi-key cache: {cache_key: {"data": [...], "timestamp": float}} ──
_cache: dict[str, dict] = {}


def _make_cache_key(category: str, topic: str) -> str:
    return f"{category.strip().lower()}|{topic.strip().lower()}"


def _clean_articles(articles: list[dict]) -> list[dict]:
    """Normalize raw API articles into a consistent format."""
    seen_urls: set[str] = set()
    clean: list[dict] = []
    for a in articles:
        url = a.get("url", "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        # Validate image URL — reject "None", empty strings, and known placeholder URLs
        image = a.get("image") or a.get("urlToImage") or ""
        if not image or image == "None" or image.startswith("data:") or len(image) < 10:
            image = ""

        clean.append({
            "title":       a.get("title") or "Untitled",
            "description": a.get("description") or "",
            "url":         url,
            "urlToImage":  image,
            "publishedAt": a.get("published") or a.get("publishedAt") or "",
            "source":      a.get("author") or a.get("source") or "",
        })
    return clean


def _fetch_from_api(category: str, topic: str) -> list[dict]:
    """
    Fetch articles from Currents News API.
    Makes up to MAX_PAGES requests to accumulate a large pool of articles.
    """
    api_key = os.getenv("CURRENTS_API_KEY")
    if not api_key or api_key == "your_currents_api_key_here":
        print("⚠️ Currents API Key is not set or is still the placeholder. Please set CURRENTS_API_KEY in your .env file.")
        return []

    all_articles: list[dict] = []

    for page_num in range(1, MAX_PAGES + 1):
        try:
            headers = {"Authorization": api_key}
            params = {
                "language": "en",
                "page_size": API_PAGE_SIZE,
                "page_number": page_num,
            }

            if topic.strip():
                url = "https://api.currentsapi.services/v1/search"
                params["keywords"] = topic.strip()
            else:
                url = "https://api.currentsapi.services/v1/latest-news"
                params["country"] = "us"

            if category.strip():
                params["category"] = category.strip().lower()

            response = requests.get(url, headers=headers, params=params, timeout=15)

            if response.status_code != 200:
                print(f"Currents API error (page {page_num}): {response.status_code} | {response.text}")
                break

            data = response.json()

            if data.get("status") == "ok":
                articles = data.get("news", [])
                all_articles.extend(articles)
                # Stop paginating if we got fewer than requested
                if len(articles) < API_PAGE_SIZE:
                    break
            else:
                print(f"Currents API status error (page {page_num}): {data}")
                break
        except Exception as e:
            print(f"News fetch exception (page {page_num}): {e}")
            break

    clean = _clean_articles(all_articles)

    # Log to history — don't let a DB error kill the fetch
    try:
        insert_history("system", "news_fetch", f"Fetched {len(clean)} articles (category={category}, topic={topic})")
    except Exception as log_err:
        print(f"History log error (non-fatal): {log_err}")

    return clean


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
