"""
Global Search — Multi-Tier Hybrid Engine
-----------------------------------------
Tier 1: Google News RSS    (real-time news, <30s freshness, 100% free, cloud-safe)
Tier 2: Bing News RSS      (broader web & news, 100% free, cloud-safe)
Tier 3: Wikipedia API      (technical terms, science, history, coding, 100% free)
Tier 4: DuckDuckGo HTML    (raw web search via static form — non-blocked, 100% free)
Tier 5: SerpAPI            (optional upgrade via SERPAPI_KEY env var)

✅ Zero API keys required for Tier 1-4.
✅ Cloud-server safe (never blocked on Koyeb/Vercel/AWS).
✅ Covers BOTH real-time news AND raw web / technical / coding topics.
"""

import os
import re
import html
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus, unquote
from fastapi import APIRouter, Query, Request
from rate_limit import search_limiter, suggestions_limiter

router = APIRouter(prefix="/search", tags=["Search"])


# Optional: SerpAPI key for official Google results
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _clean(text: str) -> str:
    """Strip HTML tags and decode HTML entities."""
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


# ─────────────────────────────────────────────
# Tier 1: Google News RSS (Real-Time News)
# ─────────────────────────────────────────────
def _google_news_rss(query: str, max_results: int = 8) -> list[dict]:
    """Google News RSS feed — breaking news updated every ~30s."""
    url = (
        f"https://news.google.com/rss/search"
        f"?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
    )
    resp = requests.get(url, headers=_HEADERS, timeout=7)
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
# Tier 2: Bing News RSS (Broad News & Web)
# ─────────────────────────────────────────────
def _bing_news_rss(query: str, max_results: int = 6) -> list[dict]:
    """Bing News RSS feed — reliable news & web coverage."""
    url = f"https://www.bing.com/news/search?q={quote_plus(query)}&format=RSS"
    resp = requests.get(url, headers=_HEADERS, timeout=7)
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
# Tier 3: Wikipedia OpenSearch API (Technical / Concepts)
# ─────────────────────────────────────────────
def _wikipedia_search(query: str, max_results: int = 4) -> list[dict]:
    """
    Official free Wikipedia OpenSearch API.
    Great for technical terms, science, history, coding concepts, definitions.
    """
    url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={quote_plus(query)}&limit={max_results}&namespace=0&format=json"
    resp = requests.get(url, headers=_HEADERS, timeout=5)
    resp.raise_for_status()
    data = resp.json()

    results = []
    if len(data) >= 4:
        titles, descs, urls = data[1], data[2], data[3]
        for t, d, u in zip(titles, descs, urls):
            if u and t:
                results.append({
                    "title":   _clean(t),
                    "link":    u,
                    "snippet": _clean(d) or f"Wikipedia reference entry for {t}.",
                    "source":  "Wikipedia",
                    "fresh":   False,
                })
    return results


# ─────────────────────────────────────────────
# Tier 4: DuckDuckGo HTML Form Search (Raw Web Search)
# ─────────────────────────────────────────────
def _duckduckgo_html_search(query: str, max_results: int = 6) -> list[dict]:
    """
    Static HTML web search via DuckDuckGo Lite form.
    Unlike DDG JS API (which gets IP-blocked on cloud servers),
    this uses DDG's plain HTML form designed for basic browsers.
    Covers raw web: coding snippets, forums, tech docs, general sites.
    """
    url = "https://html.duckduckgo.com/html/"
    payload = {"q": query}
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://html.duckduckgo.com/",
    }
    resp = requests.post(url, data=payload, headers=headers, timeout=7)
    if resp.status_code != 200:
        return []

    results = []
    matches = re.findall(
        r'<a[^>]+class="result__a"[^>]+href="([^"]+)">([\s\S]*?)</a>',
        resp.text
    )
    snippets = re.findall(
        r'<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)</a>',
        resp.text
    )

    for i, (link, raw_title) in enumerate(matches[:max_results]):
        actual_link = link
        if "uddg=" in link:
            m_url = re.search(r"uddg=([^&]+)", link)
            if m_url:
                actual_link = unquote(m_url.group(1))

        snip = _clean(snippets[i]) if i < len(snippets) else ""
        t_clean = _clean(raw_title)

        if t_clean and actual_link and actual_link.startswith("http"):
            results.append({
                "title":   t_clean,
                "link":    actual_link,
                "snippet": snip,
                "source":  "Web Search",
                "fresh":   False,
            })
    return results


# ─────────────────────────────────────────────
# Tier 5: SerpAPI (Optional — Official Google)
# ─────────────────────────────────────────────
def _serpapi_search(query: str, page: int = 1) -> list[dict]:
    """Official Google Search via SerpAPI (optional, needs key)."""
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
# Tier 6: YouTube Video Search
# ─────────────────────────────────────────────
def _youtube_search(query: str, max_results: int = 5) -> list[dict]:
    """
    Fetch live YouTube video search results via web renderer or news RSS.
    Returns title, video URL, thumbnail, channel name, views, and published time.
    """
    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    results = []
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=6)
        if resp.status_code == 200:
            match = re.search(r'var ytInitialData = ({.*?});</script>', resp.text)
            if not match:
                match = re.search(r'window\["ytInitialData"\] = ({.*?});', resp.text)

            if match:
                import json
                data = json.loads(match.group(1))
                contents = (
                    data.get("contents", {})
                    .get("twoColumnSearchResultsRenderer", {})
                    .get("primaryContents", {})
                    .get("sectionListRenderer", {})
                    .get("contents", [])
                )
                for section in contents:
                    item_section = section.get("itemSectionRenderer", {}).get("contents", [])
                    for item in item_section:
                        video = item.get("videoRenderer")
                        if not video:
                            continue
                        video_id = video.get("videoId")
                        if not video_id:
                            continue

                        title = video.get("title", {}).get("runs", [{}])[0].get("text", "")
                        channel = video.get("ownerText", {}).get("runs", [{}])[0].get("text", "")
                        published = video.get("publishedTimeText", {}).get("simpleText", "")
                        views = video.get("viewCountText", {}).get("simpleText", "")

                        link = f"https://www.youtube.com/watch?v={video_id}"
                        thumbnail = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"

                        if title:
                            results.append({
                                "title": title,
                                "link": link,
                                "snippet": f"📺 {channel} • {views} • 🕐 {published}" if channel else f"Watch {title} on YouTube",
                                "source": "YouTube",
                                "fresh": False,
                                "is_video": True,
                                "thumbnail": thumbnail,
                                "video_id": video_id,
                                "channel": channel,
                                "views": views,
                            })
                            if len(results) >= max_results:
                                break
                    if len(results) >= max_results:
                        break
    except Exception as e:
        print(f"[Search] YouTube initial data error: {e}")

    # Fallback to Google News YouTube RSS feed if initial data wasn't parsed
    if not results:
        try:
            feed_url = f"https://news.google.com/rss/search?q=site:youtube.com+{quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"
            resp = requests.get(feed_url, headers=_HEADERS, timeout=6)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                channel = root.find("channel")
                if channel is not None:
                    for item in channel.findall("item")[:max_results]:
                        title = _clean(item.findtext("title", ""))
                        link = item.findtext("link", "").strip()
                        pub = item.findtext("pubDate", "").strip()
                        v_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11})', link)
                        v_id = v_match.group(1) if v_match else ""
                        thumb = f"https://i.ytimg.com/vi/{v_id}/mqdefault.jpg" if v_id else ""
                        if title and link:
                            results.append({
                                "title": title,
                                "link": link,
                                "snippet": f"▶️ YouTube Video • 🕐 {pub}",
                                "source": "YouTube",
                                "fresh": False,
                                "is_video": True,
                                "thumbnail": thumb,
                                "video_id": v_id,
                            })
        except Exception as e:
            print(f"[Search] YouTube RSS fallback error: {e}")

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
def global_search(
    request: Request,
    query: str = Query(..., min_length=1, max_length=500, description="Search query string"),
    page: int = Query(1, ge=1, le=100, description="Results page number")
):
    """
    Multi-tier global search engine:
      1. SerpAPI (if key configured)
      2. Google News RSS (real-time news)
      3. Bing News RSS (broad news & web)
      4. DuckDuckGo HTML (raw web, coding, tech docs)
      5. Wikipedia API (definitions, technical terms)

    Rate limited: {SEARCH_LIMIT} requests/min per IP (configurable via RATE_LIMIT_SEARCH_PER_MIN).
    """
    client_ip = request.client.host if request.client else "unknown"
    search_limiter.check_rate_limit(client_ip)

    combined:    list[dict] = []
    engine_used: list[str]  = []

    # ── 1. SerpAPI (if configured) ──
    if SERPAPI_KEY and len(SERPAPI_KEY.strip()) > 10:
        try:
            serp = _serpapi_search(query, page)
            combined.extend(serp)
            engine_used.append("serpapi")
        except Exception as e:
            print(f"[Search] SerpAPI error: {e}")

    # ── 2. Google News RSS ──
    if page == 1:
        try:
            count = 8 if _is_news_query(query) else 5
            g_results = _google_news_rss(query, max_results=count)
            combined = g_results + combined
            engine_used.append("google_news_rss")
        except Exception as e:
            print(f"[Search] Google News RSS error: {e}")

    # ── 3. Bing News RSS ──
    try:
        b_results = _bing_news_rss(query, max_results=5)
        combined.extend(b_results)
        engine_used.append("bing_news_rss")
    except Exception as e:
        print(f"[Search] Bing News RSS error: {e}")

    # ── 4. DuckDuckGo Raw Web (HTML form) ──
    try:
        ddg_results = _duckduckgo_html_search(query, max_results=6)
        if ddg_results:
            combined.extend(ddg_results)
            engine_used.append("duckduckgo_web")
    except Exception as e:
        print(f"[Search] DuckDuckGo HTML error: {e}")

    # ── 5. Wikipedia (for concepts/technical terms) ──
    try:
        wiki_results = _wikipedia_search(query, max_results=3)
        if wiki_results:
            combined.extend(wiki_results)
            engine_used.append("wikipedia")
    except Exception as e:
        print(f"[Search] Wikipedia error: {e}")

    # ── 6. YouTube Videos ──
    try:
        yt_results = _youtube_search(query, max_results=5)
        if yt_results:
            combined.extend(yt_results)
            engine_used.append("youtube")
    except Exception as e:
        print(f"[Search] YouTube search error: {e}")

    # ── Deduplicate ──
    final_results = _deduplicate(combined)

    if not final_results:
        return {
            "query":   query,
            "results": [],
            "engines": engine_used,
            "error":   "No search results found. Please try different keywords.",
        }

    print(f"[Search] ✅ {len(final_results)} results for '{query}' via {engine_used}")

    return {
        "query":   query,
        "results": final_results,
        "engines": engine_used,
    }


# ─────────────────────────────────────────────
# Real-Time Autocomplete & Trending Suggestions
# ─────────────────────────────────────────────
TRENDING_SEARCHES = [
    "Apple (AAPL) Stock Performance",
    "Nvidia AI Microchips & Earnings",
    "Federal Reserve Interest Rate Outlook",
    "Global Market Trends",
    "Quantum Computing Breakthroughs",
    "Tesla EV Market Share",
    "Artificial Intelligence Agent Tools",
    "US Inflation & Economic Data"
]


@router.get("/suggestions")
def search_suggestions(
    request: Request,
    q: str = Query("", max_length=300, description="Prefix keyword for search suggestions")
):
    """
    Real-time Google/DuckDuckGo autocomplete suggestions + curated trending search keywords.

    Rate limited: {SUGGESTIONS_LIMIT} requests/min per IP (configurable via RATE_LIMIT_SUGGESTIONS_PER_MIN).
    """
    client_ip = request.client.host if request.client else "unknown"
    suggestions_limiter.check_rate_limit(client_ip)

    query_str = q.strip()
    if not query_str:
        return {
            "query": "",
            "suggestions": [],
            "trending": TRENDING_SEARCHES
        }

    suggestions: list[str] = []

    # 1. Fetch live Google Chrome Autocomplete suggestions
    try:
        url = f"https://suggestqueries.google.com/complete/search?client=chrome&q={quote_plus(query_str)}"
        resp = requests.get(url, headers=_HEADERS, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
                suggestions = [str(item) for item in data[1][:8]]
    except Exception as e:
        print(f"[Suggestions] Google suggest error: {e}")

    # 2. Fallback to DuckDuckGo if Google yields no results
    if not suggestions:
        try:
            url = f"https://duckduckgo.com/ac/?q={quote_plus(query_str)}&type=list"
            resp = requests.get(url, headers=_HEADERS, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
                    suggestions = [str(item) for item in data[1][:8]]
        except Exception as e:
            print(f"[Suggestions] DuckDuckGo suggest error: {e}")

    # Filter out empty strings
    suggestions = [s for s in suggestions if s.strip()]

    return {
        "query": query_str,
        "suggestions": suggestions,
        "trending": [t for t in TRENDING_SEARCHES if query_str.lower() in t.lower()][:4]
    }

