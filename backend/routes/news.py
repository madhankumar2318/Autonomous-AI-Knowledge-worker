import requests, time
from fastapi import APIRouter
from db import insert_history

router = APIRouter(prefix="/news", tags=["News"])

# 🔑 Your NewsAPI key
NEWS_API_KEY = "061a9915bd56414f9075c98eeab90949"
NEWS_URL = f"https://newsapi.org/v2/top-headlines?country=us&apiKey={NEWS_API_KEY}"

# 🗂 Cache
cache = {"data": [], "timestamp": 0}

@router.get("/")
def get_news():
    global cache
    now = time.time()
    try:
        if now - cache["timestamp"] > 1800 or not cache["data"]:
            response = requests.get(NEWS_URL)
            data = response.json()

            if data.get("status") == "ok":
                articles = data.get("articles", [])
                cache["data"] = [
                    {
                        "title": a.get("title"),
                        "description": a.get("description"),
                        "url": a.get("url"),
                        "urlToImage": a.get("urlToImage"),
                        "publishedAt": a.get("publishedAt"),
                    }
                    for a in articles
                ]
                cache["timestamp"] = now
                # ✅ Log to history
                insert_history("news_fetch", f"Fetched {len(articles)} articles")
            else:
                return {"news": cache["data"], "error": data.get("message")}

        return {"news": cache["data"]}
    except Exception as e:
        return {"news": cache["data"], "error": str(e)}
