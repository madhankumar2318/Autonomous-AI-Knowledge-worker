# backend/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Routers
from routes import news, stock, search, auth, upload, chat, live, settings
from routes import history as history_router

from db import init_db, is_postgres_active


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan handler — replaces deprecated @app.on_event('startup')."""
    # --- Startup ---
    try:
        init_db()
    except Exception as e:
        print(f"[ERROR] Database initialization failed on startup: {e}")
        print("[WARN] Application starting in degraded mode. DB features will not work.")
    # Initialize RAG vector store
    try:
        from rag import init_rag
        init_rag()
    except Exception as e:
        print(f"Failed to initialize RAG: {e}")
        
    # Start background live visual streams
    try:
        from routes.live import start_live_streams
        start_live_streams()
    except Exception as e:
        print(f"[ERROR] Failed to start WS live streams: {e}")

    # Scheduler disabled as report generation features were removed.
    yield
    # --- Shutdown (add cleanup here if needed) ---


app = FastAPI(title="Autonomous AI Knowledge Worker", lifespan=lifespan)

# CORS - Allow explicit origins to support credentials / cookies
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    is_prod = os.getenv("ENV", "development").lower() == "production" or os.getenv("SECURE_COOKIES", "false").lower() == "true"
    if is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Include routers
app.include_router(news.router)
app.include_router(stock.router)
app.include_router(search.router)
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(history_router.router)
app.include_router(chat.router)
app.include_router(live.router)
app.include_router(settings.router)


# Ensure folders exist
BASE_DIR = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
REPORTS_DIR = os.path.join(DATA_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)



@app.get("/db/status")
def db_status():
    return {
        "status": "healthy",
        "database": "postgres" if is_postgres_active() else "sqlite"
    }


@app.get("/")
def root():
    return {
        "message": "Backend running ✅. Use /news, /stock, /search, /auth, /upload, /history"
    }


@app.head("/")
def root_head():
    return Response(content=b"", media_type="application/json", headers={"Content-Length": "0"})
