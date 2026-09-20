import { NextResponse } from "next/server";
import { STOCKS_DATA } from "@/app/lib/stocks-data";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = (rawSymbol || "AAPL").toUpperCase();
  const url = new URL(req.url);
  const rawPeriod = (url.searchParams.get("period") || "1mo").toLowerCase();

  const stock = STOCKS_DATA.find((s) => s.symbol === symbol) || STOCKS_DATA[0];
  const currentPrice = stock.price;
  const isPos = (stock.change_percent ?? 0) >= 0;

  // Determine timeframe parameters
  let numPoints = 30;
  let totalSpanMs = 30 * 24 * 3600 * 1000;
  let periodKey = rawPeriod;

  if (rawPeriod === "1d") {
    numPoints = 24;
    totalSpanMs = 24 * 3600 * 1000;
  } else if (rawPeriod === "5d") {
    numPoints = 35;
    totalSpanMs = 5 * 24 * 3600 * 1000;
  } else if (rawPeriod === "1mo" || rawPeriod === "1m") {
    numPoints = 30;
    totalSpanMs = 30 * 24 * 3600 * 1000;
    periodKey = "1mo";
  } else if (rawPeriod === "1y") {
    numPoints = 52;
    totalSpanMs = 365 * 24 * 3600 * 1000;
  }

  const points = [];
  const now = Date.now();
  const stepMs = totalSpanMs / (numPoints - 1);

  // Generate historical curve that smoothly lands exactly on currentPrice
  const startPrice = isPos ? currentPrice * 0.94 : currentPrice * 1.06;
  const priceRange = currentPrice - startPrice;

  for (let i = 0; i < numPoints; i++) {
    const time = now - (numPoints - 1 - i) * stepMs;
    const progress = i / (numPoints - 1);

    // Natural market movement: linear trend + harmonic waves + slight jitter
    const harmonic =
      Math.sin(progress * Math.PI * 3) * (currentPrice * 0.015) +
      Math.cos(progress * Math.PI * 5) * (currentPrice * 0.008);
    
    // As progress approaches 1 (the last point), wave fades to 0 to guarantee exact currentPrice
    const damping = Math.sin(progress * Math.PI * 0.5);
    const wander = harmonic * (1 - progress * 0.8);
    let ptPrice = startPrice + priceRange * damping + wander;

    if (i === numPoints - 1) {
      ptPrice = currentPrice;
    }

    const clampedPrice = parseFloat(Math.max(1, ptPrice).toFixed(2));
    const high = parseFloat((clampedPrice * 1.008).toFixed(2));
    const low = parseFloat((clampedPrice * 0.992).toFixed(2));

    // Date formatting based on period
    const d = new Date(time);
    let dateStr = d.toISOString().split("T")[0];
    if (rawPeriod === "1d") {
      dateStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (rawPeriod === "5d") {
      dateStr = d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit" });
    }

    points.push({
      timestamp: time,
      date: dateStr,
      price: clampedPrice,
      close: clampedPrice,
      open: parseFloat((clampedPrice * 0.998).toFixed(2)),
      high,
      low,
      volume: Math.floor(stock.volume / numPoints + (Math.random() - 0.5) * (stock.volume / (numPoints * 2))),
    });
  }

  const details = {
    day_high: stock.high,
    day_low: stock.low,
    high: stock.high,
    low: stock.low,
    volume: stock.volume,
    market_cap: stock.market_cap,
    pe_ratio: stock.pe_ratio,
    fifty_two_week_high: stock.fifty_two_week_high,
    fifty_two_week_low: stock.fifty_two_week_low,
  };

  return NextResponse.json({
    symbol,
    period: periodKey,
    points,
    data: points,
    history: points,
    details,
  });
}
