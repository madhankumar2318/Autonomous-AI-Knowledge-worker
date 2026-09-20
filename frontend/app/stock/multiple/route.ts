import { NextResponse } from "next/server";
import { STOCKS_DATA } from "@/app/lib/stocks-data";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols");
  let list = STOCKS_DATA;

  if (symbolsParam) {
    const syms = symbolsParam.split(",").map((s) => s.trim().toUpperCase());
    list = STOCKS_DATA.filter((s) => syms.includes(s.symbol));
    if (list.length === 0) list = STOCKS_DATA;
  }

  // Ensure every item has both change_percent and percent_change, plus day_high and day_low
  const normalizedList = list.map((s) => ({
    ...s,
    day_high: s.high,
    day_low: s.low,
    change_percent: s.change_percent ?? s.percent_change ?? 0,
    percent_change: s.percent_change ?? s.change_percent ?? 0,
  }));

  // Group symbols by sector as string[] (matching client expectation)
  const sectors: Record<string, string[]> = {};
  for (const s of normalizedList) {
    if (!sectors[s.sector]) sectors[s.sector] = [];
    sectors[s.sector].push(s.symbol);
  }

  return NextResponse.json({
    stocks: normalizedList,
    cached: false,
    sectors,
  });
}
