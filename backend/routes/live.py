import asyncio
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from routes.stock import _fetch_all, ALL_SYMBOLS, SECTORS
from routes.news import _fetch_from_api, _make_cache_key, _cache as news_cache, CACHE_TTL as news_cache_ttl

router = APIRouter(prefix="/ws", tags=["Live"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.subscriptions: dict[WebSocket, set[str]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        print(f"[WS] Client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        print(f"[WS] Client disconnected. Active: {len(self.active_connections)}")

    async def subscribe(self, websocket: WebSocket, channels: list[str]):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(channels)
            print(f"[WS] Client subscribed to: {channels}")

    async def broadcast(self, channel: str, message: dict):
        for ws in list(self.active_connections):
            # Check subscription
            if channel in self.subscriptions.get(ws, set()):
                try:
                    await ws.send_json(message)
                except Exception:
                    self.disconnect(ws)

manager = ConnectionManager()

# Centralized locks to prevent thundering herd API storms
stocks_lock = asyncio.Lock()
news_lock = asyncio.Lock()

# Centralized caches to serve concurrent client subscriptions
_stocks_cache = {
    "data": None,
    "timestamp": 0.0
}
STOCKS_CACHE_TTL = 15.0  # seconds

# Background loops running as tasks
async def live_stocks_updater():
    while True:
        has_subscribers = any("stocks" in subs for subs in manager.subscriptions.values())
        if has_subscribers:
            try:
                # Fetch stock quotes bulk and write cache under lock
                async with stocks_lock:
                    stocks = _fetch_all(ALL_SYMBOLS)
                    _stocks_cache["data"] = {
                        "type": "stocks",
                        "data": {
                            "stocks": stocks,
                            "sectors": SECTORS
                        }
                    }
                    _stocks_cache["timestamp"] = time.time()
                await manager.broadcast("stocks", _stocks_cache["data"])
            except Exception as e:
                print(f"[WS] Error in stocks updater: {e}")
        await asyncio.sleep(15) # update every 15 seconds

async def live_news_updater():
    while True:
        has_subscribers = any("news" in subs for subs in manager.subscriptions.values())
        if has_subscribers:
            try:
                now = time.time()
                cache_key = _make_cache_key("", "")
                # Thread-safe news cache validation & update under lock
                if cache_key not in news_cache or (now - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                    async with news_lock:
                        now2 = time.time()
                        if cache_key not in news_cache or (now2 - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                            articles = _fetch_from_api("", "")
                            news_cache[cache_key] = {"data": articles, "timestamp": now2}
                            
                            payload = {
                                "type": "news",
                                "data": {
                                    "news": articles,
                                    "total": len(articles),
                                    "page": 1,
                                    "per_page": len(articles),
                                    "has_more": False
                                }
                            }
                            await manager.broadcast("news", payload)
            except Exception as e:
                print(f"[WS] Error in news updater: {e}")
        await asyncio.sleep(60) # check for news updates every 60 seconds

background_tasks = []

def start_live_streams():
    loop = asyncio.get_event_loop()
    task1 = loop.create_task(live_stocks_updater())
    task2 = loop.create_task(live_news_updater())
    background_tasks.extend([task1, task2])
    print("[WS] Background live visual streams started successfully.")

@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait for client subscribe messages
            data = await websocket.receive_json()
            if isinstance(data, dict) and data.get("type") == "subscribe":
                channels = data.get("channels", [])
                await manager.subscribe(websocket, channels)
                
                # Push initial data state immediately on subscription so client doesn't wait
                if "stocks" in channels:
                    try:
                        now = time.time()
                        if not _stocks_cache["data"] or (now - _stocks_cache["timestamp"]) > STOCKS_CACHE_TTL:
                            async with stocks_lock:
                                now2 = time.time()
                                if not _stocks_cache["data"] or (now2 - _stocks_cache["timestamp"]) > STOCKS_CACHE_TTL:
                                    print("[WS] Stocks cache expired. Fetching fresh data...")
                                    stocks = _fetch_all(ALL_SYMBOLS)
                                    _stocks_cache["data"] = {
                                        "type": "stocks",
                                        "data": {
                                            "stocks": stocks,
                                            "sectors": SECTORS
                                        }
                                    }
                                    _stocks_cache["timestamp"] = now2
                        await websocket.send_json(_stocks_cache["data"])
                    except Exception as e:
                        print(f"[WS] Error pushing initial stocks: {e}")
                if "news" in channels:
                    try:
                        now = time.time()
                        cache_key = _make_cache_key("", "")
                        if cache_key not in news_cache or (now - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                            async with news_lock:
                                now2 = time.time()
                                if cache_key not in news_cache or (now2 - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                                    print("[WS] News cache expired. Fetching fresh data...")
                                    articles = _fetch_from_api("", "")
                                    news_cache[cache_key] = {"data": articles, "timestamp": now2}
                        
                        all_articles = news_cache[cache_key]["data"]
                        await websocket.send_json({
                            "type": "news",
                            "data": {
                                "news": all_articles,
                                "total": len(all_articles),
                                "page": 1,
                                "per_page": len(all_articles),
                                "has_more": False
                            }
                        })
                    except Exception as e:
                        print(f"[WS] Error pushing initial news: {e}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] Error in websocket handler: {e}")
        manager.disconnect(websocket)
