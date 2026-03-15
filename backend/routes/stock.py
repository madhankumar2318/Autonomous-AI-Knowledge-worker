import requests
from fastapi import APIRouter, Query

router = APIRouter(prefix="/stock", tags=["Stock"])

ALPHA_KEY = "O1H6GFQHLW8CM3F4"

@router.get("/")
def get_stock(symbol: str = Query(..., description="Stock symbol like AAPL, TSLA")):
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={ALPHA_KEY}"
    response = requests.get(url)
    data = response.json()
    quote = data.get("Global Quote", {})

    if not quote:
        return {"message": "No data found", "data": {}}

    return {
        "symbol": quote.get("01. symbol"),
        "price": quote.get("05. price"),
        "change": quote.get("09. change"),
        "change_percent": quote.get("10. change percent"),
        "latest_trading_day": quote.get("07. latest trading day"),
    }
