import { NextResponse } from "next/server";
import { STOCKS_DATA } from "@/app/lib/stocks-data";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = (rawSymbol || "AAPL").toUpperCase();
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";

  const stock = STOCKS_DATA.find((s) => s.symbol === symbol) || STOCKS_DATA[0];
  const basePrice = stock.price;

  let numPoints = 14;
  if (period === "1d") numPoints = 24;
  else if (period === "5d") numPoints = 30;
  else if (period === "1m") numPoints = 30;
  else if (period === "3m") numPoints = 60;
  else if (period === "1y") numPoints = 52;

  const points = [];
  const now = Date.now();
  const stepMs = (7 * 24 * 3600 * 1000) / numPoints;

  let current = basePrice * 0.94;
  for (let i = 0; i < numPoints; i++) {
    const time = now - (numPoints - i) * stepMs;
    const delta = (Math.sin(i * 0.7) + (Math.random() - 0.48)) * (basePrice * 0.02);
    current = Math.max(10, current + delta);
    const high = current + Math.random() * (basePrice * 0.015);
    const low = current - Math.random() * (basePrice * 0.015);

    points.push({
      timestamp: time,
      date: new Date(time).toISOString().split("T")[0],
      price: parseFloat(current.toFixed(2)),
      volume: Math.floor(1000000 + Math.random() * 5000000),
      open: parseFloat((current - delta * 0.5).toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(current.toFixed(2)),
    });
  }

  return NextResponse.json({
    symbol,
    period,
    points,
  });
}
