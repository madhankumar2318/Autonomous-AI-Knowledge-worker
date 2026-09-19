import { NextResponse } from "next/server";

const MOCK_NEWS = [
  {
    title: "NVIDIA Reveals Next-Gen AI Microarchitecture Delivering 4x Inference Throughput",
    description: "NVIDIA unveiled its latest enterprise GPU system targeting real-time reasoning models and autonomous agents with substantial efficiency leaps.",
    url: "https://www.nvidia.com/news",
    source: "Bloomberg Technology",
    category: "Technology",
    published_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Global Central Banks Signal Stable Rates as Disinflation Progress Holds Steady",
    description: "Federal Reserve and ECB officials indicated balanced macroeconomic conditions, prompting capital inflows into technology and growth sectors.",
    url: "https://www.ft.com",
    source: "Financial Times",
    category: "Finance",
    published_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Autonomous Knowledge Workers Transform Corporate Strategy & Due Diligence",
    description: "Enterprise software teams report 60% acceleration in document synthesis, regulatory compliance checks, and cross-market intelligence with autonomous AI.",
    url: "https://www.reuters.com",
    source: "Reuters",
    category: "Technology",
    published_at: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Semiconductor Sector Rallies as Foundry Utilization Hits Multi-Year Highs",
    description: "Surging demand for specialized edge chips and memory bandwidth fuels sustained upside across semiconductor equipment makers.",
    url: "https://www.wsj.com",
    source: "Wall Street Journal",
    category: "Markets",
    published_at: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Quantum Computing Algorithms Show Breakthrough in Portfolio Risk Hedging",
    description: "Researchers at leading financial institutions demonstrate quadratic speedups in high-dimensional Monte Carlo risk calculations.",
    url: "https://www.nature.com",
    source: "TechCrunch",
    category: "AI",
    published_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Renewable Energy Grid Integration Meets 40% Target Ahead of Schedule",
    description: "Battery energy storage systems and distributed grid controllers enable unprecedented penetration of clean solar and wind baseload power.",
    url: "https://www.cnbc.com",
    source: "CNBC",
    category: "Energy",
    published_at: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    url_to_image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const category = (url.searchParams.get("category") || "").toLowerCase();

  let filtered = MOCK_NEWS;
  if (category && category !== "all") {
    filtered = MOCK_NEWS.filter((n) => n.category.toLowerCase() === category);
    if (filtered.length === 0) filtered = MOCK_NEWS;
  }

  const articles = filtered.map((a) => ({
    ...a,
    publishedAt: a.published_at,
    urlToImage: a.url_to_image,
  }));

  return NextResponse.json({
    articles,
    news: articles,
    page,
    total_results: articles.length,
    total: articles.length,
  });
}
