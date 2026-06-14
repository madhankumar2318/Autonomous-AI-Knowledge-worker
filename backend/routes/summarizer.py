# backend/routes/summarizer.py
from fastapi import APIRouter
from pydantic import BaseModel
from utils.summarizer import summarize

router = APIRouter(prefix="/summarize", tags=["Summarizer"])

class TextRequest(BaseModel):
    text: str

@router.post("/")
def summarize_text(req: TextRequest):
    text = req.text.strip()
    if not text:
        return {"summary": "No content to summarize"}

    try:
        summary = summarize(text, max_sentences=2)
        return {"summary": summary}
    except Exception as e:
        return {"summary": f"Error summarizing text: {str(e)}"}
