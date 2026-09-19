import { NextResponse } from "next/server";
import { STOCKS_DATA } from "@/app/lib/stocks-data";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();
  const stock = STOCKS_DATA.find((s) => s.symbol === symbol) || {
    symbol,
    name: `${symbol} Inc.`,
    company_name: `${symbol} Inc.`,
    price: 150.0,
    change: 1.5,
    percent_change: 1.0,
    open: 148.5,
    high: 151.2,
    low: 148.0,
    volume: 12000000,
    sector: "Technology",
    pe_ratio: 28.0,
    market_cap: "$500B",
    fifty_two_week_high: 175.0,
    fifty_two_week_low: 120.0,
  };

  return NextResponse.json(stock);
}
