import time
import yfinance as yf
from fastapi import APIRouter, Query

router = APIRouter(prefix="/stock", tags=["Stock"])

# ─── Comprehensive stock list by sector ──────────────────────────────────────
SECTORS: dict[str, list[str]] = {
    "Technology":   ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMD", "INTC", "CRM", "ORCL", "ADBE", "QCOM", "TXN"],
    "Consumer Tech":["AMZN", "TSLA", "NFLX", "UBER", "ABNB", "SNAP", "PINS"],
    "Finance":      ["JPM", "BAC", "GS", "MS", "V", "MA", "WFC", "AXP", "BLK"],
    "Healthcare":   ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT"],
    "Energy":       ["XOM", "CVX", "COP", "SLB", "PSX"],
    "Consumer":     ["WMT", "HD", "MCD", "SBUX", "NKE", "COST", "TGT"],
    "Industrial":   ["BA", "CAT", "HON", "UPS", "GE"],
    "ETFs":         ["SPY", "QQQ", "DIA", "IWM", "VTI"],
}

ALL_SYMBOLS = [sym for syms in SECTORS.values() for sym in syms]

# ─── Cache (TTL = 15 min) ─────────────────────────────────────────────────────
_cache: dict[str, tuple[list, float]] = {}
CACHE_TTL = 15 * 60  # 15 minutes


def _build_quote(ticker_info: dict, symbol: str) -> dict:
    """Extract and normalise fields from yfinance info dict."""
    price = ticker_info.get("currentPrice") or ticker_info.get("regularMarketPrice") or ticker_info.get("previousClose")
    prev_close = ticker_info.get("regularMarketPreviousClose") or ticker_info.get("previousClose") or 0

    if price and prev_close:
        change = round(float(price) - float(prev_close), 4)
        change_pct = round((change / float(prev_close)) * 100, 4) if prev_close else 0
    else:
        change = change_pct = 0

    return {
        "symbol": symbol,
        "name": ticker_info.get("shortName") or ticker_info.get("longName") or symbol,
        "price": round(float(price), 2) if price else None,
        "change": change,
        "change_percent": change_pct,
        "volume": ticker_info.get("regularMarketVolume"),
        "market_cap": ticker_info.get("marketCap"),
        "day_high": ticker_info.get("dayHigh") or ticker_info.get("regularMarketDayHigh"),
        "day_low": ticker_info.get("dayLow") or ticker_info.get("regularMarketDayLow"),
    }


def _fetch_all(symbols: list[str]) -> list[dict]:
    """Fetch all symbols in one yfinance batch call."""
    results = []
    try:
        tickers = yf.Tickers(" ".join(symbols))
        for sym in symbols:
            try:
                info = tickers.tickers[sym].info
                results.append(_build_quote(info, sym))
            except Exception:
                results.append({"symbol": sym, "error": "Unavailable"})
    except Exception as e:
        for sym in symbols:
            results.append({"symbol": sym, "error": str(e)})
    return results


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/multiple")
def get_multiple_stocks(
    symbols: str = Query(
        ",".join(ALL_SYMBOLS),
        description="Comma-separated symbols. Leave blank for all defaults."
    )
):
    """Return quote data for multiple symbols (cached 15 min via yfinance)."""
    now = time.time()
    cache_key = symbols.upper().replace(" ", "")

    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return {"stocks": data, "cached": True, "sectors": SECTORS}

    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    stocks = _fetch_all(symbol_list)
    _cache[cache_key] = (stocks, now)
    return {"stocks": stocks, "cached": False, "sectors": SECTORS}


@router.get("/sectors")
def get_sectors():
    """Return the sector → symbols mapping."""
    return SECTORS


# ─── Legacy single-symbol endpoint (kept for compatibility) ──────────────────
@router.get("/")
def get_stock(symbol: str = Query(..., description="Stock symbol like AAPL, TSLA")):
    cache_key = symbol.upper()
    now = time.time()
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if now - ts < CACHE_TTL:
            return data[0] if data else {}

    results = _fetch_all([symbol.upper()])
    _cache[cache_key] = (results, now)
    return results[0] if results else {"error": "Not found"}
