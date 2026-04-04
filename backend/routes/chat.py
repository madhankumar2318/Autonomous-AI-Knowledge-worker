from fastapi import APIRouter
from pydantic import BaseModel
import asyncio
import random

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
async def chat(req: ChatRequest):
    message = req.message.lower().strip()
    
    # Simulate thinking delay to make the UI look realistic
    await asyncio.sleep(random.uniform(0.6, 1.5))
    
    # Mock AI logic based on keywords
    if "news" in message:
        response = "Today's top news is looking active! Tech stocks are reacting to recent AI advancements, and global markets are seeing a mixed bag of results. Let me know if you want me to format a detailed report."
    elif "stock" in message or "market" in message:
        response = "The stock market is showing strong performance in the tech sector today. AAPL and NVDA are leading the charge. You can check the live ticker on the right for exact prices!"
    elif "hello" in message or "hi" in message or "hey" in message:
        response = "Hello there! I'm your Autonomous AI Knowledge Worker. I can help you analyze news, check stock trends, or generate comprehensive reports. What can I do for you today?"
    elif "report" in message:
        response = "I can certainly help with reports! You can generate a full data report by clicking the 'Report' button in the top right corner of the dashboard."
    else:
        # Generic response
        responses = [
            "That's an interesting point. As an AI, I'm analyzing the latest data streams to get you more context on that.",
            "I'm currently running in Mock mode, but rest assured, my interface is fully functional! I can still respond to basic queries.",
            "I see! Let me cross-reference that with today's news and market data...",
            "Could you elaborate slightly? I want to make sure I pull the exact insights you're looking for from our dashboard capabilities."
        ]
        response = random.choice(responses)
        
    return {"reply": response}
