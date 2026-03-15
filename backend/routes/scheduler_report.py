# backend/routes/scheduler_report.py
import os
import json
import time
import requests
from fastapi import APIRouter
from db import insert_report, get_conn

router = APIRouter(prefix="/report", tags=["Report"])

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
REPORTS_DIR = os.path.join(DATA_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

@router.post("/generate_now")
def generate_report_now():
    """
    Generate a simple report by calling /news and /stock endpoints.
    This is intentionally simple: collect top 5 news and a sample stock (e.g., AAPL).
    """
    try:
        # fetch top news
        news_res = requests.get("http://127.0.0.1:8000/news?page=1&page_size=5")
        news_json = news_res.json() if news_res.ok else {"news": []}

        # fetch a sample stock snapshot (you could change to multiple)
        stock_symbol = "AAPL"
        stock_res = requests.get(f"http://127.0.0.1:8000/stock?symbol={stock_symbol}")
        stock_json = stock_res.json() if stock_res.ok else {}

        report = {
            "generated_at": time.time(),
            "news": news_json.get("news", []),
            "stock": stock_json,
        }

        # save JSON file
        ts = int(time.time())
        fname = f"report_{ts}.json"
        fpath = os.path.join(REPORTS_DIR, fname)
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # make summary text (very simple)
        summary = f"{len(report['news'])} news items; stock {stock_symbol} snapshot."

        # insert into DB
        insert_report(title=f"Auto report {time.strftime('%Y-%m-%d %H:%M:%S')}", json_path=fpath, summary=summary)

        return {"status": "ok", "file": fpath}
    except Exception as e:
        return {"status": "error", "error": str(e)}
