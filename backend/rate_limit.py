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
            # Clear old requests outside the sliding window
            self.requests[key] = [t for t in self.requests[key] if now - t < self.window]
            
            if len(self.requests[key]) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Limit is {self.limit} requests per {self.window} seconds. Please wait."
                )
            
            self.requests[key].append(now)

# Load limits from environment variables for production flexibility
CHAT_LIMIT = int(os.getenv("RATE_LIMIT_CHAT_PER_MIN", "15"))
UPLOAD_LIMIT = int(os.getenv("RATE_LIMIT_UPLOAD_PER_MIN", "5"))

chat_limiter = SlidingWindowRateLimiter(limit=CHAT_LIMIT, window=60)
upload_limiter = SlidingWindowRateLimiter(limit=UPLOAD_LIMIT, window=60)
