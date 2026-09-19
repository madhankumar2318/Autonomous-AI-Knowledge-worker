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

  const sectors: Record<string, typeof STOCKS_DATA> = {};
  for (const s of list) {
    if (!sectors[s.sector]) sectors[s.sector] = [];
    sectors[s.sector].push(s);
  }

  return NextResponse.json({
    stocks: list,
    cached: false,
    sectors,
  });
}
