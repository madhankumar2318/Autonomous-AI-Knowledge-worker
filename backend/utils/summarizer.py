# backend/utils/summarizer.py
import os
from google import genai

def summarize(text: str, max_sentences: int = 2) -> str:
    """
    Summarizes text using Gemini if API key is present.
    Otherwise, falls back to a simple sentence-splitting fallback.
    """
    if not text or not text.strip():
        return "No content available to summarize."

    # Check for Gemini API key
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and not api_key.startswith("your_") and len(api_key.strip()) > 10:
        try:
            client = genai.Client(api_key=api_key.strip())
            prompt = f"Summarize the following text concisely. Keep the summary under {max_sentences * 15} words:\n\n{text}"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            if response.text:
                return response.text.strip()
        except Exception as e:
            print(f"Gemini summarizer exception: {e}")

    # Fallback to simple summarizer
    sentences = text.split(". ")
    summary = ". ".join(sentences[:max_sentences])
    if summary:
        if not summary.endswith("."):
            summary += "."
        return summary
    return "No summary available"
