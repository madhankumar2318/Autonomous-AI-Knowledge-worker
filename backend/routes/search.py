import requests
import os
from fastapi import APIRouter, Query

router = APIRouter(prefix="/search", tags=["Search"])

# SerpAPI key (optional — DuckDuckGo is used as fallback if unreachable)
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "274cc21d7e711fa7d08ff66ffd401b3558a0d12f8bebb0a6b4cd31059b77cdfb")


def _serpapi_search(query: str, page: int = 1) -> list[dict]:
    """Search via SerpAPI (Google). Raises on any error."""
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": 10,
        "start": (page - 1) * 10,
    }
    response = requests.get(
        "https://serpapi.com/search.json",
        params=params,
        timeout=8,
    )
    data = response.json()
    if "error" in data:
        raise RuntimeError(f"SerpAPI error: {data['error']}")
    results = []
    for item in data.get("organic_results", []):
        results.append({
            "title":   item.get("title", ""),
            "link":    item.get("link", ""),
            "snippet": item.get("snippet", ""),
        })
    return results


def _duckduckgo_search(query: str, page: int = 1) -> list[dict]:
    """Search via DuckDuckGo (free, no key required). Raises on any error."""
    from duckduckgo_search import DDGS
    max_results = 10
    offset = (page - 1) * max_results
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results + offset):
            results.append({
                "title":   r.get("title", "No title"),
                "link":    r.get("href", ""),
                "snippet": r.get("body", ""),
            })
    return results[offset:offset + max_results]


@router.get("/")
def global_search(query: str = Query(...), page: int = 1):
    """
    Global search endpoint.
    Tries SerpAPI (Google) first; automatically falls back to DuckDuckGo
    if SerpAPI is unreachable, quota-exceeded, or returns an error.
    """
    # 1. Try SerpAPI if key looks valid
    if SERPAPI_KEY and len(SERPAPI_KEY.strip()) > 10:
        try:
            results = _serpapi_search(query, page)
            print(f"[Search] SerpAPI OK — {len(results)} results for '{query}'")
            return {"query": query, "results": results, "engine": "google"}
        except Exception as e:
            print(f"[Search] SerpAPI failed: {e}. Falling back to DuckDuckGo...")

    # 2. Fallback: DuckDuckGo (always free, no quota)
    try:
        results = _duckduckgo_search(query, page)
        print(f"[Search] DuckDuckGo OK — {len(results)} results for '{query}'")
        return {"query": query, "results": results, "engine": "duckduckgo"}
    except Exception as e:
        print(f"[Search] DuckDuckGo also failed: {e}")
        return {"query": query, "results": [], "error": "All search providers failed. Please try again later."}
