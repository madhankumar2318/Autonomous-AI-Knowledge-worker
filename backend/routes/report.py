from fastapi import APIRouter
from utils.summarizer import summarize
from utils.pdf import generate_pdf

router = APIRouter(prefix="/report", tags=["Report"])

@router.post("/")
def generate_report(news: list = [], stock: dict = {}, insights: list = []):
    summary = summarize(news)
    filename = generate_pdf(news, stock, insights)
    return {"message": "Report generated", "summary": summary, "file": filename}
