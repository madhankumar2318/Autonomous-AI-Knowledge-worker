# backend/routes/report_builder.py
import os, time, json, textwrap
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from db import insert_report, get_conn

router = APIRouter(prefix="/report", tags=["Report Builder"])

# Directory where main.py mounted /reports -> data/reports
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
REPORTS_DIR = os.path.join(BASE_DIR, "data", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

class NewsItem(BaseModel):
    title: str
    url: Optional[str] = None
    description: Optional[str] = None

class StockItem(BaseModel):
    symbol: str
    price: Optional[str] = None
    change: Optional[str] = None
    change_percent: Optional[str] = None

class BuildPayload(BaseModel):
    title: Optional[str] = "Custom Report"
    news: Optional[List[NewsItem]] = []
    stock: Optional[StockItem] = None
    uploads: Optional[List[str]] = []   # filenames
    notes: Optional[str] = None

def simple_summary(text: str, max_chars: int = 300):
    """Very simple summarizer: pick first sentence(s) up to limit."""
    if not text:
        return ""
    text = text.strip()
    # split by sentences (naive)
    sentences = text.split(". ")
    summary = ""
    for s in sentences:
        if len(summary) + len(s) + 1 > max_chars:
            break
        summary += (s.strip() + ". ")
    return summary.strip()

@router.post("/build")
def build_report(payload: BuildPayload):
    try:
        # Build report content
        pieces = []
        pieces.append(payload.title or "Custom Report")
        pieces.append("=" * 40)
        pieces.append("")

        insights = []

        # News
        if payload.news:
            pieces.append("News:")
            for i, n in enumerate(payload.news, start=1):
                s = simple_summary(n.description or n.title or "", max_chars=250)
                pieces.append(f"{i}. {n.title}")
                if s:
                    pieces.append(f"   Summary: {s}")
                    insights.append(s)
                if n.url:
                    pieces.append(f"   Link: {n.url}")
                pieces.append("")
        else:
            pieces.append("No news included.")
            pieces.append("")

        # Stock
        if payload.stock:
            st = payload.stock
            pieces.append("Stock:")
            pieces.append(f"Symbol: {st.symbol}")
            if st.price:
                pieces.append(f"Price: {st.price} ({st.change} / {st.change_percent})")
            pieces.append("")
            if st.price:
                insights.append(f"Stock {st.symbol}: {st.price} {st.change_percent or ''}")

        # Uploads
        if payload.uploads:
            pieces.append("Uploads included:")
            for u in payload.uploads:
                pieces.append(f" - {u}")
            pieces.append("")
        else:
            pieces.append("No uploads included.")
            pieces.append("")

        # Additional notes
        if payload.notes:
            pieces.append("Notes:")
            pieces.append(payload.notes)
            pieces.append("")

        # Simple auto insights (join top summaries)
        auto_insights = "\n".join(insights[:5])

        # File name
        ts = int(time.time())
        safe_title = "".join(c for c in (payload.title or "report") if c.isalnum() or c in (" ", "_")).strip().replace(" ", "_")
        base_filename = f"{safe_title}_{ts}"
        txt_filename = base_filename + ".txt"
        txt_path = os.path.join(REPORTS_DIR, txt_filename)

        # Write TXT always
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(pieces))

        # Try to produce PDF if reportlab available
        pdf_filename = base_filename + ".pdf"
        pdf_path = os.path.join(REPORTS_DIR, pdf_filename)
        made_pdf = False
        try:
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            styles = getSampleStyleSheet()
            doc = SimpleDocTemplate(pdf_path)
            story = []
            for p in pieces:
                # keep paragraphs short
                story.append(Paragraph(textwrap.escape(p).replace("\n", "<br/>"), styles["Normal"]))
                story.append(Spacer(1, 6))
            doc.build(story)
            made_pdf = True
        except Exception:
            made_pdf = False

        final_filename = pdf_filename if made_pdf else txt_filename

        # Insert metadata in DB
        insert_report(payload.title or "Custom Report", final_filename,
                      [n.dict() for n in payload.news] if payload.news else [],
                      payload.stock.dict() if payload.stock else {},
                      payload.uploads or [],
                      [ins for ins in insights])

        # Return public URL path (main.py mounts /reports)
        return {"status": "ok", "filename": final_filename, "url": f"/reports/{final_filename}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
