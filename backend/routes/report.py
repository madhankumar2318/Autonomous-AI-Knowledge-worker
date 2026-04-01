from fastapi import APIRouter
from typing import Optional
from utils.summarizer import summarize
from utils.pdf import generate_pdf

router = APIRouter(prefix="/report", tags=["Report"])

@router.post("/")
def generate_report(
    news: Optional[list] = None,
    stock: Optional[dict] = None,
    insights: Optional[list] = None,
):
    """Generate a PDF report from news, stock and insights data."""
    news = news or []
    stock = stock or {}
    insights = insights or []

    summary = summarize(news)
    filename = generate_pdf(news, stock, insights)
    return {"message": "Report generated", "summary": summary, "file": filename}
