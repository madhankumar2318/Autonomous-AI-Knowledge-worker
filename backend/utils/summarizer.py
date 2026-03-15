def summarize(text: str, max_sentences: int = 2) -> str:
    """
    Very simple summarizer:
    Splits text into sentences and returns first N sentences.
    """
    if not text:
        return "No summary available"

    sentences = text.split(". ")
    summary = ". ".join(sentences[:max_sentences])
    return summary if summary else "No summary available"
