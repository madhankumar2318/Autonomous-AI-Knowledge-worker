"""
Global Search — Multi-Tier Hybrid Engine
-----------------------------------------
Tier 1: Google News RSS      (real-time news, <30s freshness, 100% free)
Tier 2: DuckDuckGo DDGS      (full web search, old + new, 100% free)
Tier 3: SerpAPI (Google)     (optional upgrade via SERPAPI_KEY env var)

No API keys required for Tier 1 & 2. Always returns results.
"""

import os
import re
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from fastapi import APIRouter, Query

router = APIRouter(prefix="/search", tags=["Search"])

# Optional: SerpAPI key for official Google results
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

# ─────────────────────────────────────────────
# Tier 1: Google News RSS (real-time, 100% free)
# ─────────────────────────────────────────────
def _google_news_rss(query: str, max_results: int = 5) -> list[dict]:
    """
    Fetch real-time results from Google News RSS feed.
    Updates within ~30 seconds of breaking news. Zero API key needed.
    """
    url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; AIKnowledgeWorker/1.0)"
    }
    try:
        response = requests.get(url, headers=headers, timeout=6)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Google News RSS fetch failed: {e}")

    results = []
    try:
        root = ET.fromstring(response.content)
        ns = {"media": "http://search.yahoo.com/mrss/"}
        channel = root.find("channel")
        if channel is None:
            return []

        for item in channel.findall("item")[:max_results]:
            title = item.findtext("title", default="").strip()
            link  = item.findtext("link", default="").strip()
            desc  = item.findtext("description", default="").strip()
            pub   = item.findtext("pubDate", default="").strip()

            # Clean HTML tags from description
            desc_clean = re.sub(r"<[^>]+>", "", desc).strip()

            # Prefix snippet with freshness timestamp
            snippet = f"🕐 {pub} — {desc_clean}" if pub else desc_clean

            if title and link:
                results.append({
                    "title":   title,
                    "link":    link,
                    "snippet": snippet,
                    "source":  "Google News (Real-Time)",
                    "fresh":   True,
                })
    except ET.ParseError as e:
        raise RuntimeError(f"Google News RSS parse error: {e}")

    return results


# ─────────────────────────────────────────────
# Tier 2: DuckDuckGo Web Search (full web, 100% free)
# ─────────────────────────────────────────────
def _duckduckgo_search(query: str, page: int = 1, max_results: int = 10) -> list[dict]:
    """
    Full general web search via DuckDuckGo. Covers old & new content.
    No API key required, no monthly limits.
    """
    from duckduckgo_search import DDGS
    offset = (page - 1) * max_results
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results + offset):
            results.append({
                "title":   r.get("title", "No title"),
                "link":    r.get("href", ""),
                "snippet": r.get("body", ""),
                "source":  "DuckDuckGo Web",
                "fresh":   False,
            })
    return results[offset:offset + max_results]


# ─────────────────────────────────────────────
# Tier 3: SerpAPI (Optional — real Google results)
# ─────────────────────────────────────────────
def _serpapi_search(query: str, page: int = 1) -> list[dict]:
    """
    Official Google search via SerpAPI (100 free searches/month).
    Only used if SERPAPI_KEY env var is configured.
    """
    params = {
        "engine":  "google",
        "q":       query,
        "api_key": SERPAPI_KEY,
        "num":     10,
        "start":   (page - 1) * 10,
    }
    response = requests.get("https://serpapi.com/search.json", params=params, timeout=8)
    data = response.json()
    if "error" in data:
        raise RuntimeError(f"SerpAPI error: {data['error']}")

    results = []
    for item in data.get("organic_results", []):
        results.append({
            "title":   item.get("title", ""),
            "link":    item.get("link", ""),
            "snippet": item.get("snippet", ""),
            "source":  "Google Search",
            "fresh":   False,
        })
    return results


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def _is_news_query(query: str) -> bool:
    """
    Detect if the query is likely asking for recent/news content.
    If yes, prioritize Google News RSS for freshness.
    """
    news_keywords = [
        "news", "latest", "today", "breaking", "recent", "2024", "2025", "2026",
        "update", "announce", "launch", "release", "report", "market", "stock",
        "price", "earnings", "crash", "surge", "election", "war", "disaster",
    ]
    q_lower = query.lower()
    return any(kw in q_lower for kw in news_keywords)


def _deduplicate(results: list[dict]) -> list[dict]:
    """Remove duplicate results by URL."""
    seen = set()
    deduped = []
    for r in results:
        link = r.get("link", "").strip().rstrip("/")
        if link and link not in seen:
            seen.add(link)
            deduped.append(r)
    return deduped


# ─────────────────────────────────────────────
# Main Search Endpoint
# ─────────────────────────────────────────────
@router.get("/")
def global_search(query: str = Query(...), page: int = 1):
    """
    Multi-tier global search endpoint.

    Strategy:
    1. Always try Google News RSS first for real-time breaking news results.
    2. Combine with DuckDuckGo for full web coverage (old + new content).
    3. Use SerpAPI if SERPAPI_KEY is set (optional upgrade for 100% Google).
    4. Return merged, deduplicated results with freshness labels.
    """
    combined: list[dict] = []
    engine_used: list[str] = []

    # ── Tier 3: SerpAPI if key configured ──
    if SERPAPI_KEY and len(SERPAPI_KEY.strip()) > 10:
        try:
            serp_results = _serpapi_search(query, page)
            combined.extend(serp_results)
            engine_used.append("serpapi")
            print(f"[Search] SerpAPI ✅ — {len(serp_results)} results")
        except Exception as e:
            print(f"[Search] SerpAPI ❌ — {e}")

    # ── Tier 1: Google News RSS (real-time, always attempted) ──
    # For page 1 or news-style queries, prepend fresh RSS results
    if page == 1:
        try:
            news_count = 6 if _is_news_query(query) else 4
            rss_results = _google_news_rss(query, max_results=news_count)
            # Prepend news results at the top for freshness
            combined = rss_results + combined
            engine_used.append("google_news_rss")
            print(f"[Search] Google News RSS ✅ — {len(rss_results)} results")
        except Exception as e:
            print(f"[Search] Google News RSS ❌ — {e}")

    # ── Tier 2: DuckDuckGo (full web — always attempted) ──
    try:
        ddg_results = _duckduckgo_search(query, page=page, max_results=10)
        combined.extend(ddg_results)
        engine_used.append("duckduckgo")
        print(f"[Search] DuckDuckGo ✅ — {len(ddg_results)} results")
    except Exception as e:
        print(f"[Search] DuckDuckGo ❌ — {e}")

    # ── Deduplicate and return ──
    final_results = _deduplicate(combined)

    if not final_results:
        return {
            "query":   query,
            "results": [],
            "engines": engine_used,
            "error":   "All search providers failed. Please try again later.",
        }

    print(f"[Search] ✅ Final: {len(final_results)} results via {engine_used}")
    return {
        "query":   query,
        "results": final_results,
        "engines": engine_used,
    }
