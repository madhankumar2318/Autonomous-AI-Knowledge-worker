import requests
from fastapi import APIRouter, Query

router = APIRouter(prefix="/search", tags=["Search"])

# 🔑 SerpAPI key
SERPAPI_KEY = "274cc21d7e711fa7d08ff66ffd401b3558a0d12f8bebb0a6b4cd31059b77cdfb"

@router.get("/")
def serpapi_search(query: str = Query(...), page: int = 1):
    """
    Google search via SerpAPI
    """
    try:
        params = {
            "engine": "google",
            "q": query,
            "api_key": SERPAPI_KEY,
            "num": 10,
            "start": (page - 1) * 10
        }

        response = requests.get(
            "https://serpapi.com/search.json",
            params=params,
            timeout=10
        )

        data = response.json()

        # 🔴 SerpAPI error handling
        if "error" in data:
            return {
                "results": [],
                "error": data["error"]
            }

        results = []
        for item in data.get("organic_results", []):
            results.append({
                "title": item.get("title"),
                "link": item.get("link"),
                "snippet": item.get("snippet")
            })

        return {
            "query": query,
            "results": results
        }

    except Exception as e:
        return {
            "results": [],
            "error": str(e)
        }
