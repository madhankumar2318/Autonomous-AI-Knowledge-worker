import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();

  const allSuggestions = [
    "NVDA earnings forecast",
    "Semiconductor supply chain analysis",
    "Fed interest rate path 2026",
    "AI agent reasoning benchmark",
    "Tech sector valuations Q3",
    "AAPL gross margin trends",
    "Renewable energy capacity additions",
    "Autonomous enterprise knowledge worker architecture",
  ];

  const suggestions = q
    ? allSuggestions.filter((s) => s.toLowerCase().includes(q))
    : allSuggestions.slice(0, 5);

  return NextResponse.json({
    query: q,
    suggestions: suggestions.length > 0 ? suggestions : [q, `${q} market forecast`, `${q} research`],
    trending: [
      "NVDA",
      "AI Inference Chips",
      "Macro Liquidity",
      "Autonomous Agents",
    ],
  });
}
