import time
import yfinance as yf
from fastapi import APIRouter, Query
from concurrent.futures import ThreadPoolExecutor, as_completed


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

# ─── Comprehensive Stock Names Dictionary ─────────────────────────────────────
COMPANY_NAMES = {
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "NVDA": "NVIDIA Corp.", "GOOGL": "Alphabet Inc.", 
    "META": "Meta Platforms Inc.", "AMD": "Advanced Micro Devices", "INTC": "Intel Corp.", 
    "CRM": "Salesforce Inc.", "ORCL": "Oracle Corp.", "ADBE": "Adobe Inc.", "QCOM": "Qualcomm Inc.", 
    "TXN": "Texas Instruments", "AMZN": "Amazon.com Inc.", "TSLA": "Tesla Inc.", "NFLX": "Netflix Inc.", 
    "UBER": "Uber Technologies", "ABNB": "Airbnb Inc.", "SNAP": "Snap Inc.", "PINS": "Pinterest Inc.", 
    "JPM": "JPMorgan Chase & Co.", "BAC": "Bank of America Corp.", "GS": "Goldman Sachs Group", 
    "MS": "Morgan Stanley", "V": "Visa Inc.", "MA": "Mastercard Inc.", "WFC": "Wells Fargo & Co.", 
    "AXP": "American Express", "BLK": "BlackRock Inc.", "JNJ": "Johnson & Johnson", 
    "UNH": "UnitedHealth Group", "PFE": "Pfizer Inc.", "ABBV": "AbbVie Inc.", "MRK": "Merck & Co.", 
    "LLY": "Eli Lilly & Co.", "TMO": "Thermo Fisher Scientific", "ABT": "Abbott Laboratories", 
    "XOM": "Exxon Mobil Corp.", "CVX": "Chevron Corp.", "COP": "ConocoPhillips", "SLB": "Schlumberger Ltd.", 
    "PSX": "Phillips 66", "WMT": "Walmart Inc.", "HD": "Home Depot Inc.", "MCD": "McDonald's Corp.", 
    "SBUX": "Starbucks Corp.", "NKE": "Nike Inc.", "COST": "Costco Wholesale", "TGT": "Target Corp.", 
    "BA": "Boeing Co.", "CAT": "Caterpillar Inc.", "HON": "Honeywell International", 
    "UPS": "United Parcel Service", "GE": "General Electric", "SPY": "SPDR S&P 500 ETF", 
    "QQQ": "Invesco QQQ Trust", "DIA": "SPDR Dow Jones Industrial Average ETF", 
    "IWM": "iShares Russell 2000 ETF", "VTI": "Vanguard Total Stock Market ETF"
}


# ─── Cache (TTL = 15 min) ─────────────────────────────────────────────────────
_cache: dict[str, tuple[list, float]] = {}
CACHE_TTL = 15 * 60  # 15 minutes


def _fetch_all(symbols: list[str]) -> list[dict]:
    """Fetch all symbols data from a single bulk history request. Ultra-fast!"""
    results = []
    if not symbols:
        return results

    try:
        tickers = yf.Tickers(" ".join(symbols))
        
        # Download history for the last 7 days (includes Open, High, Low, Close, Volume)
        try:
            bulk_history = tickers.history(period="7d")
        except Exception as e:
            print("Bulk history download failed:", e)
            bulk_history = None

        for sym in symbols:
            try:
                name = COMPANY_NAMES.get(sym, sym)

                # Initialize values
                history_list = []
                price = None
                prev_close = None
                day_high = None
                day_low = None
                volume = None

                if bulk_history is not None and not bulk_history.empty:
                    # MultiIndex columns case
                    if isinstance(bulk_history.columns, tuple) or hasattr(bulk_history.columns, 'levels'):
                        if 'Close' in bulk_history.columns and sym in bulk_history['Close'].columns:
                            close_series = bulk_history['Close'][sym].dropna()
                            history_list = close_series.tolist()
                            if len(history_list) >= 1:
                                price = history_list[-1]
                            if len(history_list) >= 2:
                                prev_close = history_list[-2]

                        if 'High' in bulk_history.columns and sym in bulk_history['High'].columns:
                            high_series = bulk_history['High'][sym].dropna()
                            if not high_series.empty:
                                day_high = high_series.iloc[-1]

                        if 'Low' in bulk_history.columns and sym in bulk_history['Low'].columns:
                            low_series = bulk_history['Low'][sym].dropna()
                            if not low_series.empty:
                                day_low = low_series.iloc[-1]

                        if 'Volume' in bulk_history.columns and sym in bulk_history['Volume'].columns:
                            vol_series = bulk_history['Volume'][sym].dropna()
                            if not vol_series.empty:
                                volume = int(vol_series.iloc[-1])
                    else:
                        # Single column case
                        if 'Close' in bulk_history.columns:
                            close_series = bulk_history['Close'].dropna()
                            history_list = close_series.tolist()
                            if len(history_list) >= 1:
                                price = history_list[-1]
                            if len(history_list) >= 2:
                                prev_close = history_list[-2]

                        if 'High' in bulk_history.columns:
                            high_series = bulk_history['High'].dropna()
                            if not high_series.empty:
                                day_high = high_series.iloc[-1]

                        if 'Low' in bulk_history.columns:
                            low_series = bulk_history['Low'].dropna()
                            if not low_series.empty:
                                day_low = low_series.iloc[-1]

                        if 'Volume' in bulk_history.columns:
                            vol_series = bulk_history['Volume'].dropna()
                            if not vol_series.empty:
                                volume = int(vol_series.iloc[-1])

                # Calculate changes
                if price is not None and prev_close is not None and prev_close > 0:
                    change = round(float(price) - float(prev_close), 4)
                    change_pct = round((change / float(prev_close)) * 100, 4)
                else:
                    change = change_pct = 0.0

                results.append({
                    "symbol": sym,
                    "name": name,
                    "price": round(float(price), 2) if price is not None else None,
                    "change": change,
                    "change_percent": change_pct,
                    "volume": volume,
                    "market_cap": None,  # Fetched dynamically on-demand in details modal
                    "day_high": round(float(day_high), 2) if day_high is not None else None,
                    "day_low": round(float(day_low), 2) if day_low is not None else None,
                    "history": [round(float(p), 2) for p in history_list]
                })
            except Exception as e:
                results.append({"symbol": sym, "error": str(e)})

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


@router.get("/history/{symbol}")
def get_stock_history(
    symbol: str,
    period: str = Query("1mo", description="1d, 5d, 1mo, 1y")
):
    """
    Get historical data for stock charting.
    Returns list of date-price pairs along with single-stock detail stats (Market Cap).
    """
    try:
        ticker = yf.Ticker(symbol.upper())
        
        # Fetch detailed metrics (Market Cap, Volume, High, Low) for this specific stock
        details = {}
        try:
            info = ticker.info
            details = {
                "market_cap": info.get("marketCap"),
                "volume": info.get("regularMarketVolume"),
                "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
                "day_low": info.get("dayLow") or info.get("regularMarketDayLow")
            }
        except Exception as detail_err:
            print("Failed to fetch detailed yfinance metrics:", detail_err)

        # Determine frequency/interval
        interval = "1d"
        if period == "1d":
            interval = "5m"
        elif period == "5d":
            interval = "30m"

        hist = ticker.history(period=period, interval=interval)

        # Fallback if empty (e.g. off-hours / weekend for 1d)
        if hist.empty and period == "1d":
            hist = ticker.history(period="5d", interval="60m")

        data = []
        for date, row in hist.iterrows():
            if "Close" in row:
                price = float(row["Close"])
                if price == price:  # filter out NaN
                    if period == "1d":
                        date_str = date.strftime("%H:%M")
                    elif period == "5d":
                        date_str = date.strftime("%a %H:%M")
                    else:
                        date_str = date.strftime("%Y-%m-%d")

                    data.append({
                        "date": date_str,
                        "price": round(price, 2)
                    })
        return {
            "symbol": symbol.upper(),
            "period": period,
            "data": data,
            "details": details
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "error": str(e), "data": [], "details": {}}


