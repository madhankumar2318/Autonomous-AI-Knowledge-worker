import { NextResponse } from "next/server";
import { STOCKS_DATA } from "@/app/lib/stocks-data";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";

const SYMBOL_REGEX = /^[A-Z0-9.\-]{1,10}$/;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  // Rate limit: 60 requests per minute per IP
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`stock_multiple:${ip}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: `Too many stock requests. Please wait ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols");
  let list = STOCKS_DATA;

  if (symbolsParam) {
    // Validate each symbol — reject malformed ones
    const syms = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => SYMBOL_REGEX.test(s));
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
