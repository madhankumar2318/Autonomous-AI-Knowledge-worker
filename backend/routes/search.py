"""
Global Search — Multi-Tier Hybrid Engine
-----------------------------------------
Tier 1: Google News RSS  (real-time, <30s freshness, 100% free, cloud-safe)
Tier 2: Bing News RSS    (broader web coverage, 100% free, cloud-safe)
Tier 3: SerpAPI          (optional upgrade via SERPAPI_KEY env var)

✅ No API keys required for Tier 1 & 2.
✅ Both use legitimate RSS endpoints — never blocked by cloud IPs.
✅ DuckDuckGo scraper removed (was blocked on Koyeb/cloud server IPs).
"""

import os
import re
import html
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus
from fastapi import APIRouter, Query

router = APIRouter(prefix="/search", tags=["Search"])

# Optional: SerpAPI key for official Google results
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def _clean(text: str) -> str:
    """Strip HTML tags and decode HTML entities."""
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


# ─────────────────────────────────────────────
# Tier 1: Google News RSS
# ─────────────────────────────────────────────
def _google_news_rss(query: str, max_results: int = 8) -> list[dict]:
    """
    Google News RSS — real-time breaking news, updated every ~30s.
    Zero API key, completely free, works from any cloud server.
    """
    url = (
        f"https://news.google.com/rss/search"
        f"?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    )
    resp = requests.get(url, headers=_HEADERS, timeout=8)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    channel = root.find("channel")
    if channel is None:
        return []

    results = []
    for item in channel.findall("item")[:max_results]:
        title = _clean(item.findtext("title", ""))
        link  = item.findtext("link", "").strip()
        desc  = _clean(item.findtext("description", ""))
        pub   = item.findtext("pubDate", "").strip()

        snippet = f"🕐 {pub} — {desc}" if pub else desc

        if title and link:
            results.append({
                "title":   title,
                "link":    link,
                "snippet": snippet,
                "source":  "Google News",
                "fresh":   True,
            })
    return results


# ─────────────────────────────────────────────
# Tier 2: Bing News RSS (replaces DuckDuckGo)
# ─────────────────────────────────────────────
def _bing_news_rss(query: str, max_results: int = 8) -> list[dict]:
    """
    Bing News RSS — broad web & news coverage, all dates (old + new).
    Zero API key, completely free, works reliably from cloud servers.
    Uses Microsoft's legitimate RSS endpoint — never blocked.
    """
    url = f"https://www.bing.com/news/search?q={quote_plus(query)}&format=RSS"
    resp = requests.get(url, headers=_HEADERS, timeout=8)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    channel = root.find("channel")
    if channel is None:
        return []

    results = []
    for item in channel.findall("item")[:max_results]:
        title = _clean(item.findtext("title", ""))
        link  = item.findtext("link", "").strip()
        desc  = _clean(item.findtext("description", ""))
        pub   = item.findtext("pubDate", "").strip()

        snippet = f"🕐 {pub} — {desc}" if pub else desc

        if title and link:
            results.append({
                "title":   title,
                "link":    link,
                "snippet": snippet,
                "source":  "Bing News",
                "fresh":   True,
            })
    return results


# ─────────────────────────────────────────────
# Tier 3: SerpAPI (Optional — official Google)
# ─────────────────────────────────────────────
def _serpapi_search(query: str, page: int = 1) -> list[dict]:
    """
    Official Google Search via SerpAPI.
    Only used if SERPAPI_KEY env var is set (100 free searches/month).
    """
    params = {
        "engine":  "google",
        "q":       query,
        "api_key": SERPAPI_KEY,
        "num":     10,
        "start":   (page - 1) * 10,
    }
    resp = requests.get("https://serpapi.com/search.json", params=params, timeout=8)
    data = resp.json()
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
    news_keywords = [
        "news", "latest", "today", "breaking", "recent", "2024", "2025", "2026",
        "update", "announce", "launch", "release", "report", "market", "stock",
        "price", "earnings", "crash", "surge", "election", "war", "disaster",
        "match", "score", "live", "result", "winner",
    ]
    q_lower = query.lower()
    return any(kw in q_lower for kw in news_keywords)


def _deduplicate(results: list[dict]) -> list[dict]:
    """Remove duplicate results by URL."""
    seen: set[str] = set()
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
    Multi-tier global search — all sources are cloud-server safe RSS feeds.

    Strategy:
      1. Google News RSS  — real-time breaking news (always tried)
      2. Bing News RSS    — broader general web coverage (always tried)
      3. SerpAPI          — official Google (optional, needs API key)
    """
    combined:       list[dict] = []
    engine_used:    list[str]  = []
    failed_engines: list[str]  = []

    # ── Tier 3: SerpAPI (only if key is set) ──
    if SERPAPI_KEY and len(SERPAPI_KEY.strip()) > 10:
        try:
            serp = _serpapi_search(query, page)
            combined.extend(serp)
            engine_used.append("serpapi")
            print(f"[Search] SerpAPI ✅ — {len(serp)} results")
        except Exception as e:
            failed_engines.append("serpapi")
            print(f"[Search] SerpAPI ❌ — {e}")

    # ── Tier 1: Google News RSS ──
    if page == 1:
        try:
            count = 10 if _is_news_query(query) else 8
            g_results = _google_news_rss(query, max_results=count)
            combined = g_results + combined          # prepend for freshness
            engine_used.append("google_news_rss")
            print(f"[Search] Google News RSS ✅ — {len(g_results)} results")
        except Exception as e:
            failed_engines.append("google_news_rss")
            print(f"[Search] Google News RSS ❌ — {e}")

    # ── Tier 2: Bing News RSS ──
    try:
        b_results = _bing_news_rss(query, max_results=8)
        combined.extend(b_results)
        engine_used.append("bing_news_rss")
        print(f"[Search] Bing News RSS ✅ — {len(b_results)} results")
    except Exception as e:
        failed_engines.append("bing_news_rss")
        print(f"[Search] Bing News RSS ❌ — {e}")

    # ── Deduplicate ──
    final_results = _deduplicate(combined)

    if not final_results:
        return {
            "query":   query,
            "results": [],
            "engines": engine_used,
            "error":   "All search sources failed. Please try again later.",
        }

    print(f"[Search] ✅ {len(final_results)} results via {engine_used}")

    response: dict = {
        "query":   query,
        "results": final_results,
        "engines": engine_used,
    }

    # Soft warning only if EVERY engine failed (very unlikely now)
    if failed_engines and not engine_used:
        response["error"] = "Some sources timed out — showing partial results."

    return response
