import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";
import { STOCKS_DATA } from "@/app/lib/stocks-data";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") || "").toLowerCase().trim();
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const results: any[] = [];

  // Match stocks
  for (const stock of STOCKS_DATA) {
    if (!query || stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query)) {
      results.push({
        title: `${stock.symbol} - ${stock.name}`,
        snippet: `Current price: $${stock.price} (${stock.change >= 0 ? "+" : ""}${stock.percent_change}%). Sector: ${stock.sector}. Market Cap: ${stock.market_cap}.`,
        url: `https://finance.yahoo.com/quote/${stock.symbol}`,
        source: "Market Intelligence",
        category: "Stock",
        published_at: new Date().toISOString(),
      });
    }
  }

  // Match uploaded documents
  for (const [, doc] of uploadsStore) {
    if (!query || doc.filename.toLowerCase().includes(query) || (doc.content && doc.content.toLowerCase().includes(query))) {
      results.push({
        title: `Document: ${doc.originalName}`,
        snippet: doc.content ? doc.content.slice(0, 200) + "..." : "Uploaded enterprise knowledge document.",
        url: `/upload/content/${doc.filename}`,
        source: "Workspace Documents",
        category: "Document",
        published_at: doc.uploadedAt,
      });
    }
  }

  // General fallback results
  if (results.length === 0) {
    results.push({
      title: `Research Analysis: "${query || "Autonomous Systems"}"`,
      snippet: `Comprehensive autonomous synthesis for ${query || "enterprise AI systems"} highlighting strategic workflows, real-time data ingestion, and performance impact.`,
      url: "https://research.knowledge-worker.local",
      source: "AI Knowledge Core",
      category: "Research",
      published_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    query,
    results,
    page,
    total_results: results.length,
    total: results.length,
  });
}
