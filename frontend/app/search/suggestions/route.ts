import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";

export async function GET(req: Request) {
  // Rate limit: 120 suggestion requests per minute per IP
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`search_suggestions:${ip}`, 120, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: `Too many suggestions requests. Please wait ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const url = new URL(req.url);
  // Cap query length to 100 chars to prevent DoS via oversized payload
  const rawQ = url.searchParams.get("q") || "";
  const q = rawQ.slice(0, 100).toLowerCase().trim();

  const allSuggestions = [
    "NVDA earnings forecast & AI roadmap",
    "Semiconductor supply chain analysis 2026",
    "Fed interest rate path & liquidity projections",
    "India economic growth & tech ecosystem",
    "India technology & semiconductor investments",
    "AI agent reasoning benchmarks & autonomous systems",
    "Tech sector valuations and corporate margins",
    "AAPL gross margin trends & hardware releases",
    "Renewable energy capacity & grid battery storage",
    "Autonomous enterprise knowledge worker architecture",
    "Quantum computing fault-tolerant benchmarks",
    "Tesla EV market share & autonomous robotaxi",
  ];

  let suggestions: string[] = [];

  if (q) {
    suggestions = allSuggestions.filter((s) => s.toLowerCase().includes(q));
    if (suggestions.length === 0) {
      const cap = q.charAt(0).toUpperCase() + q.slice(1);
      suggestions = [
        `${cap} market forecast & outlook 2026`,
        `${cap} latest news & developments`,
        `${cap} technical analysis & research brief`,
        `${cap} YouTube documentary & expert breakdown`,
      ];
    }
  } else {
    suggestions = allSuggestions.slice(0, 6);
  }

  return NextResponse.json({
    query: q,
    suggestions,
    trending: [
      "NVDA Blackwell",
      "India Tech Surge",
      "AI Reasoning Models",
      "Quantum Computing",
      "Fed Rate Decision",
      "Autonomous Agents",
    ],
  });
}
