# backend/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Routers
from routes import news, stock, search, auth, upload, chat
from routes import history as history_router

from db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan handler — replaces deprecated @app.on_event('startup')."""
    # --- Startup ---
    init_db()
    # Initialize RAG vector store
    try:
        from rag import init_rag
        init_rag()
    except Exception as e:
        print(f"Failed to initialize RAG: {e}")
        
    # Scheduler disabled as report generation features were removed.
    yield
    # --- Shutdown (add cleanup here if needed) ---


app = FastAPI(title="Autonomous AI Knowledge Worker", lifespan=lifespan)

# CORS - Allow explicit origins to support credentials / cookies
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
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

# Include routers
app.include_router(news.router)
app.include_router(stock.router)
app.include_router(search.router)
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(history_router.router)
app.include_router(chat.router)

# Ensure folders exist
BASE_DIR = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
REPORTS_DIR = os.path.join(DATA_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# Mount static routes
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")


@app.get("/")
def root():
    return {
        "message": "Backend running ✅. Use /news, /stock, /search, /auth, /upload, /history"
    }
