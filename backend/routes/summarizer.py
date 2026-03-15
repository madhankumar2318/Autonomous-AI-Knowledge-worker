from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/summarize", tags=["Summarizer"])

class TextRequest(BaseModel):
    text: str

@router.post("/")
def summarize_text(req: TextRequest):
    text = req.text.strip()

    if not text:
        return {"summary": "No content to summarize"}

    try:
        # Simple fallback summarizer: take first 2 sentences
        sentences = text.split(". ")
        if len(sentences) > 2:
            summary = ". ".join(sentences[:2]) + "."
        else:
            summary = text if len(text) < 150 else text[:150] + "..."

        return {"summary": summary}

    except Exception as e:
        return {"summary": f"Error summarizing: {str(e)}"}
