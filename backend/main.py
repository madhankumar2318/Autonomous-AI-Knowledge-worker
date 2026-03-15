# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Routers (ensure these exist or comment out if conflicting)
from routes import news, stock, search, auth, report, summarizer, upload
from routes import history as history_router
from routes import scheduler_report as scheduler_report_router
# New report_builder route (create file below)
from routes import report_builder

from db import init_db
import scheduler as scheduler_module  # optional; keep if you have this

app = FastAPI(title="Autonomous AI Knowledge Worker")

# CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Must be False when allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(news.router)
app.include_router(stock.router)
app.include_router(search.router)
app.include_router(auth.router)
app.include_router(report.router)
app.include_router(summarizer.router)
app.include_router(upload.router)
app.include_router(history_router.router)
app.include_router(scheduler_report_router.router)
app.include_router(report_builder.router)  # <-- new route

# Ensure folders
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

@app.on_event("startup")
def on_startup():
    init_db()
    # optional scheduler start - if you have scheduler.py
    try:
        scheduler_module.start_scheduler()
    except Exception:
        pass

@app.get("/")
def root():
    return {"message": "Backend running ✅. Use /news, /stock, /search, /auth, /report, /summarize, /upload, /history, /report/build"}
