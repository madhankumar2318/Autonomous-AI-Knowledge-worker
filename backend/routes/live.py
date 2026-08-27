import asyncio
import os
import re
import time
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from routes.stock import _fetch_all_fast as _fetch_all, ALL_SYMBOLS, SECTORS
from routes.news import _fetch_from_api, _make_cache_key, _cache as news_cache, CACHE_TTL as news_cache_ttl

router = APIRouter(prefix="/ws", tags=["Live"])

# ── Allowed Channels for Live Subscriptions ──────────────────────────────────
ALLOWED_CHANNELS = {"stocks", "news"}

# ── Origin Validation for Cross-Site WebSocket Hijacking (CSWSH) Defense ─────
def _get_allowed_origins() -> list[str]:
    """Compile list of trusted origins for WebSocket handshakes."""
    frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    extra_origins = os.getenv("EXTRA_CORS_ORIGINS", "")
    for o in extra_origins.split(","):
        clean_o = o.strip().rstrip("/")
        if clean_o and clean_o not in origins:
            origins.append(clean_o)
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)
    return origins


def is_origin_allowed(origin: Optional[str]) -> bool:
    """Validate whether an incoming WebSocket Origin header is authorized."""
    if not origin:
        # Non-browser clients (e.g. CLI tools/tests) may not send Origin headers.
        is_prod = os.getenv("ENV", "development").lower() == "production" or os.getenv("SECURE_COOKIES", "false").lower() == "true"
        # In strict production, require origin unless explicitly relaxed
        return not is_prod

    clean_origin = origin.strip().rstrip("/").lower()
    allowed = [o.lower() for o in _get_allowed_origins()]

    if clean_origin in allowed:
        return True

    # Permit local development ports dynamically (e.g. localhost:3000, localhost:3001)
    if re.match(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", clean_origin):
        return True

    return False


class ConnectionManager:
    """Manages active WebSocket connections with global & per-IP throttling."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.subscriptions: dict[WebSocket, set[str]] = {}
        self.ws_to_ip: dict[WebSocket, str] = {}
        self.ip_connections: dict[str, int] = {}
        self.max_global_connections = int(os.getenv("WS_MAX_CONNECTIONS", "200"))
        self.max_per_ip = int(os.getenv("WS_MAX_PER_IP", "15"))

    async def connect(self, websocket: WebSocket, client_ip: str = "unknown") -> bool:
        """Accept a new WebSocket connection if within capacity limits."""
        # 1. Global connection capacity check
        if len(self.active_connections) >= self.max_global_connections:
            print(f"[WS Security] Rejected connection: global capacity reached ({len(self.active_connections)}/{self.max_global_connections})")
            await websocket.close(code=1013, reason="Server busy, try again later")
            return False

        # 2. Per-IP connection throttling check
        current_ip_count = self.ip_connections.get(client_ip, 0)
        if current_ip_count >= self.max_per_ip:
            print(f"[WS Security] Rejected connection from {client_ip}: IP connection limit reached ({current_ip_count}/{self.max_per_ip})")
            await websocket.close(code=1008, reason="Connection limit exceeded")
            return False

        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        self.ws_to_ip[websocket] = client_ip
        self.ip_connections[client_ip] = current_ip_count + 1
        print(f"[WS] Client connected ({client_ip}). Active: {len(self.active_connections)}")
        return True

    def disconnect(self, websocket: WebSocket):
        """Clean up connection references and release IP count."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        client_ip = self.ws_to_ip.pop(websocket, None)
        if client_ip and client_ip in self.ip_connections:
            self.ip_connections[client_ip] = max(0, self.ip_connections[client_ip] - 1)
            if self.ip_connections[client_ip] == 0:
                del self.ip_connections[client_ip]
        print(f"[WS] Client disconnected ({client_ip or 'unknown'}). Active: {len(self.active_connections)}")

    async def subscribe(self, websocket: WebSocket, channels: list[str]):
        """Subscribe client to authorized channels only."""
        if websocket in self.subscriptions and isinstance(channels, list):
            valid_channels = {
                c.strip().lower()
                for c in channels[:10]
                if isinstance(c, str) and c.strip().lower() in ALLOWED_CHANNELS
            }
            self.subscriptions[websocket].update(valid_channels)
            print(f"[WS] Client subscribed to: {list(valid_channels)}")

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
    # Pre-warm stocks cache on startup immediately
    try:
        print("[WS] Pre-warming stocks cache on startup...")
        async with stocks_lock:
            stocks = await asyncio.to_thread(_fetch_all, ALL_SYMBOLS)
            _stocks_cache["data"] = {
                "type": "stocks",
                "data": {
                    "stocks": stocks,
                    "sectors": SECTORS
                }
            }
            _stocks_cache["timestamp"] = time.time()
        print("[WS] Stocks cache pre-warmed successfully.")
    except Exception as e:
        print(f"[WS] Warning: Stocks pre-warm failed: {e}")

    while True:
        await asyncio.sleep(15) # update every 15 seconds
        has_subscribers = any("stocks" in subs for subs in manager.subscriptions.values())
        if has_subscribers:
            try:
                # Fetch stock quotes bulk and write cache under lock (non-blocking)
                async with stocks_lock:
                    stocks = await asyncio.to_thread(_fetch_all, ALL_SYMBOLS)
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

async def live_news_updater():
    # Pre-warm news cache on startup immediately
    try:
        print("[WS] Pre-warming news cache on startup...")
        async with news_lock:
            now = time.time()
            cache_key = _make_cache_key("", "")
            articles = await asyncio.to_thread(_fetch_from_api, "", "")
            news_cache[cache_key] = {"data": articles, "timestamp": now}
        print("[WS] News cache pre-warmed successfully.")
    except Exception as e:
        print(f"[WS] Warning: News pre-warm failed: {e}")

    while True:
        await asyncio.sleep(60) # check for news updates every 60 seconds
        has_subscribers = any("news" in subs for subs in manager.subscriptions.values())
        if has_subscribers:
            try:
                now = time.time()
                cache_key = _make_cache_key("", "")
                # Thread-safe news cache validation & update under lock (non-blocking)
                if cache_key not in news_cache or (now - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                    async with news_lock:
                        now2 = time.time()
                        if cache_key not in news_cache or (now2 - news_cache[cache_key]["timestamp"]) > news_cache_ttl:
                            articles = await asyncio.to_thread(_fetch_from_api, "", "")
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

background_tasks = []

def start_live_streams():
    loop = asyncio.get_event_loop()
    task1 = loop.create_task(live_stocks_updater())
    task2 = loop.create_task(live_news_updater())
    background_tasks.extend([task1, task2])
    print("[WS] Background live visual streams started successfully.")

@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    # ── 1. CSWSH Defense: Origin Header Validation ───────────────────────────
    origin = websocket.headers.get("origin")
    if origin and not is_origin_allowed(origin):
        print(f"[WS Security] Rejected connection from unauthorized origin: {origin}")
        await websocket.close(code=1008, reason="Unauthorized origin")
        return

    # ── 2. Connection Throttling (Global & Per-IP) ────────────────────────────
    client_ip = websocket.client.host if websocket.client else "unknown"
    connected = await manager.connect(websocket, client_ip)
    if not connected:
        return

    try:
        while True:
            # Wait for client subscribe messages
            data = await websocket.receive_json()
            if isinstance(data, dict) and data.get("type") == "subscribe":
                raw_channels = data.get("channels", [])
                if isinstance(raw_channels, list):
                    # Filter and sanitize channels to permitted set only
                    channels = [
                        c.strip().lower()
                        for c in raw_channels[:10]
                        if isinstance(c, str) and c.strip().lower() in ALLOWED_CHANNELS
                    ]
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
                                    stocks = await asyncio.to_thread(_fetch_all, ALL_SYMBOLS)
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
                                    articles = await asyncio.to_thread(_fetch_from_api, "", "")
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

