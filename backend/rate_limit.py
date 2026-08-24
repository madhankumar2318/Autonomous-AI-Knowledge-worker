import time
import threading
import os
from collections import defaultdict
from fastapi import HTTPException


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window: int = 60):
        self.limit = limit
        self.window = window
        self.requests = defaultdict(list)
        self.lock = threading.Lock()

    def check_rate_limit(self, key: str):
        now = time.time()
        with self.lock:
            # Evict timestamps outside the current sliding window
            self.requests[key] = [t for t in self.requests[key] if now - t < self.window]

            if len(self.requests[key]) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Limit is {self.limit} requests per {self.window} seconds. Please wait.",
                    headers={"Retry-After": str(self.window)},
                )

            self.requests[key].append(now)

    def cleanup_expired_keys(self):
        """Remove keys that have no active (non-expired) timestamps.
        Call periodically to prevent unbounded memory growth on long-running servers.
        """
        now = time.time()
        with self.lock:
            expired_keys = [
                key for key, timestamps in self.requests.items()
                if not any(now - t < self.window for t in timestamps)
            ]
            for key in expired_keys:
                del self.requests[key]
        if expired_keys:
            print(f"[RateLimit] Cleaned {len(expired_keys)} expired key(s) from memory.")


def _start_cleanup_scheduler(limiters: list, interval_seconds: int = 600):
    """Background daemon thread that cleans all limiter stores every `interval_seconds`.
    Runs as a daemon so it exits automatically when the main process stops.
    """
    def _run():
        while True:
            time.sleep(interval_seconds)
            for limiter in limiters:
                try:
                    limiter.cleanup_expired_keys()
                except Exception as e:
                    print(f"[RateLimit] Cleanup error: {e}")

    t = threading.Thread(target=_run, daemon=True, name="RateLimitCleanup")
    t.start()


# ── Load limits from environment variables for production flexibility ──────────
# Auth & Upload (sensitive — strict limits)
CHAT_LIMIT        = int(os.getenv("RATE_LIMIT_CHAT_PER_MIN",        "15"))
UPLOAD_LIMIT      = int(os.getenv("RATE_LIMIT_UPLOAD_PER_MIN",       "5"))
AUTH_LIMIT        = int(os.getenv("RATE_LIMIT_AUTH_PER_MIN",         "5"))

# Search & Stock (external API proxies — moderate limits to protect API quotas)
SEARCH_LIMIT      = int(os.getenv("RATE_LIMIT_SEARCH_PER_MIN",       "20"))
SUGGESTIONS_LIMIT = int(os.getenv("RATE_LIMIT_SUGGESTIONS_PER_MIN",  "40"))
STOCK_LIMIT       = int(os.getenv("RATE_LIMIT_STOCK_PER_MIN",        "30"))
NEWS_LIMIT        = int(os.getenv("RATE_LIMIT_NEWS_PER_MIN",         "30"))

chat_limiter        = SlidingWindowRateLimiter(limit=CHAT_LIMIT,        window=60)
upload_limiter      = SlidingWindowRateLimiter(limit=UPLOAD_LIMIT,      window=60)
auth_limiter        = SlidingWindowRateLimiter(limit=AUTH_LIMIT,        window=60)
search_limiter      = SlidingWindowRateLimiter(limit=SEARCH_LIMIT,      window=60)
suggestions_limiter = SlidingWindowRateLimiter(limit=SUGGESTIONS_LIMIT, window=60)
stock_limiter       = SlidingWindowRateLimiter(limit=STOCK_LIMIT,       window=60)
news_limiter        = SlidingWindowRateLimiter(limit=NEWS_LIMIT,        window=60)

# Start background cleanup daemon — runs every 10 minutes, covers ALL limiters
_start_cleanup_scheduler(
    [chat_limiter, upload_limiter, auth_limiter,
     search_limiter, suggestions_limiter, stock_limiter, news_limiter],
    interval_seconds=600
)
