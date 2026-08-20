"use client";
import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Building2,
  Cpu,
  Code2,
  DollarSign,
  Globe,
  ArrowRight,
  BarChart2,
  Layers,
  Calendar,
  UserCheck,
} from "lucide-react";
import { API_BASE_URL } from "../config";

export interface KnowledgeEntity {
  id: string;
  name: string;
  ticker?: string;
  exchange?: string;
  category: "stock" | "ai_company" | "tech" | "crypto" | "framework";
  badge: string;
  description: string;
  founded?: string;
  headquarters?: string;
  leadership?: string;
  marketCap?: string;
  keyProducts?: string[];
  website?: string;
  accentColor?: string;
}

// ─── Curated Knowledge Base ──────────────────────────────────────────────────
export const KNOWLEDGE_ENTITIES: KnowledgeEntity[] = [
  {
    id: "nvda",
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    exchange: "NASDAQ",
    category: "stock",
    badge: "AI Semiconductor & Accelerated Computing",
    description:
      "NVIDIA pioneered accelerated computing to tackle challenges ordinary computers cannot solve. The company dominates the global AI training and inference accelerator market with its Hopper and Blackwell GPU architectures and CUDA software ecosystem.",
    founded: "1993 (Sunnyvale, CA)",
    headquarters: "Santa Clara, California, USA",
    leadership: "Jensen Huang (Founder & CEO)",
    marketCap: "$3.15 Trillion",
    keyProducts: ["Blackwell B200", "H100/H200 Tensor Core", "CUDA Platform", "GeForce RTX"],
    website: "https://www.nvidia.com",
    accentColor: "#22c55e",
  },
  {
    id: "aapl",
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Consumer Tech & Silicon Engineering",
    description:
      "Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories, along with a broad range of related services. It is pioneering on-device personal intelligence with Apple Intelligence.",
    founded: "1976 (Los Altos, CA)",
    headquarters: "Cupertino, California, USA",
    leadership: "Tim Cook (CEO)",
    marketCap: "$3.42 Trillion",
    keyProducts: ["iPhone", "MacBook / M-Series Silicon", "Apple Intelligence", "Services / iCloud"],
    website: "https://www.apple.com",
    accentColor: "#38bdf8",
  },
  {
    id: "msft",
    name: "Microsoft Corporation",
    ticker: "MSFT",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Enterprise Cloud & AI Systems",
    description:
      "Microsoft develops software, hardware, services, and cloud computing solutions. It leads commercial AI integration across enterprises via Microsoft Azure, Azure OpenAI Service, and Microsoft Copilot.",
    founded: "1975 (Albuquerque, NM)",
    headquarters: "Redmond, Washington, USA",
    leadership: "Satya Nadella (Chairman & CEO)",
    marketCap: "$3.20 Trillion",
    keyProducts: ["Azure Cloud", "Microsoft Copilot", "Windows 11", "GitHub & Office 365"],
    website: "https://www.microsoft.com",
    accentColor: "#60a5fa",
  },
  {
    id: "tsla",
    name: "Tesla, Inc.",
    ticker: "TSLA",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Electric Vehicles & Autonomous AI",
    description:
      "Tesla designs, develops, manufactures, sells, and leases electric vehicles, energy generation and storage systems, and advanced autonomous driving neural networks powered by Dojo and Full Self-Driving (FSD) software.",
    founded: "2003 (San Carlos, CA)",
    headquarters: "Austin, Texas, USA",
    leadership: "Elon Musk (Technoking & CEO)",
    marketCap: "$720 Billion",
    keyProducts: ["Model Y / Model 3", "Full Self-Driving (FSD)", "Optimus Humanoid Robot", "Megapack Energy"],
    website: "https://www.tesla.com",
    accentColor: "#ef4444",
  },
  {
    id: "googl",
    name: "Alphabet Inc. (Google)",
    ticker: "GOOGL",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Search, Cloud & Frontier AI",
    description:
      "Alphabet is the parent company of Google, Android, YouTube, and Waymo. Its frontier AI research wing, Google DeepMind, develops the Gemini multimodal foundation models and Google Cloud Vertex AI platforms.",
    founded: "1998 (Menlo Park, CA)",
    headquarters: "Mountain View, California, USA",
    leadership: "Sundar Pichai (CEO)",
    marketCap: "$2.15 Trillion",
    keyProducts: ["Google Search", "Gemini 2.5 AI Models", "Google Cloud Platform", "YouTube & Android"],
    website: "https://abc.xyz",
    accentColor: "#3b82f6",
  },
  {
    id: "amzn",
    name: "Amazon.com, Inc.",
    ticker: "AMZN",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Cloud Infrastructure & Global E-Commerce",
    description:
      "Amazon is the global leader in cloud computing (Amazon Web Services), e-commerce retail, and digital streaming. AWS powers the infrastructure for top frontier AI labs worldwide via Bedrock and Trainium chips.",
    founded: "1994 (Bellevue, WA)",
    headquarters: "Seattle, Washington, USA",
    leadership: "Andy Jassy (President & CEO)",
    marketCap: "$2.05 Trillion",
    keyProducts: ["AWS Cloud Infrastructure", "Amazon Bedrock", "Amazon Prime E-Commerce", "Trainium / Inferentia"],
    website: "https://www.amazon.com",
    accentColor: "#f59e0b",
  },
  {
    id: "meta",
    name: "Meta Platforms, Inc.",
    ticker: "META",
    exchange: "NASDAQ",
    category: "stock",
    badge: "Social Technologies & Open Source AI",
    description:
      "Meta builds technologies that help people connect, find communities, and grow businesses. Meta champions open-weights AI through its industry-standard Llama foundation model series.",
    founded: "2004 (Cambridge, MA)",
    headquarters: "Menlo Park, California, USA",
    leadership: "Mark Zuckerberg (Founder, Chairman & CEO)",
    marketCap: "$1.45 Trillion",
    keyProducts: ["Llama 3.3 Open Foundation Models", "Instagram & WhatsApp", "Meta AI Assistant", "Quest VR / Reality Labs"],
    website: "https://about.meta.com",
    accentColor: "#06b6d4",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "ai_company",
    badge: "Frontier AI & AGI Research Lab",
    description:
      "OpenAI is an AI research and deployment company dedicated to ensuring artificial general intelligence benefits all of humanity. It created ChatGPT, GPT-4o, DALL-E, and Sora.",
    founded: "2015 (San Francisco, CA)",
    headquarters: "San Francisco, California, USA",
    leadership: "Sam Altman (CEO) & Greg Brockman (President)",
    keyProducts: ["GPT-4o / GPT-4.5", "ChatGPT Enterprise", "OpenAI o1 / o3 Reasoning", "Sora Video Generator"],
    website: "https://openai.com",
    accentColor: "#10b981",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai_company",
    badge: "AI Safety & Frontier Model Lab",
    description:
      "Anthropic is an AI safety and research company that builds reliable, interpretable, and steerable AI systems. It created the industry-leading Claude 3.5 Sonnet, Claude 3 Opus, and Computer Use APIs.",
    founded: "2021 (San Francisco, CA)",
    headquarters: "San Francisco, California, USA",
    leadership: "Dario Amodei (CEO) & Daniela Amodei (President)",
    keyProducts: ["Claude 3.5 Sonnet", "Claude 3 Opus", "Constitutional AI Safety", "Computer Use API"],
    website: "https://www.anthropic.com",
    accentColor: "#d97706",
  },
  {
    id: "deepseek",
    name: "DeepSeek AI",
    category: "ai_company",
    badge: "Open Reasoning & High-Efficiency AI",
    description:
      "DeepSeek is a pioneer in open-weights mathematical and logical reasoning models. Its architectures (DeepSeek-V3 and DeepSeek-R1) proved frontier-class performance with unprecedented compute efficiency.",
    founded: "2023 (Hangzhou, China)",
    headquarters: "Hangzhou, China",
    leadership: "Liang Wenfeng (Founder & CEO)",
    keyProducts: ["DeepSeek-R1 (Reasoning)", "DeepSeek-V3 (MoE Architecture)", "DeepSeek Coder", "DualPipe Engine"],
    website: "https://www.deepseek.com",
    accentColor: "#3b82f6",
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    category: "ai_company",
    badge: "Scientific Discovery & General Intelligence",
    description:
      "Google DeepMind combines world-class scientists and engineers to build general intelligence and solve critical scientific challenges, including the Nobel Prize-winning AlphaFold protein folding engine and Gemini multimodal models.",
    founded: "2010 (London, UK)",
    headquarters: "London, United Kingdom",
    leadership: "Demis Hassabis (CEO & Nobel Laureate)",
    keyProducts: ["Gemini 2.5 Multimodal", "AlphaFold 3 (Biomolecular)", "AlphaCode", "Imagen 3"],
    website: "https://deepmind.google",
    accentColor: "#8b5cf6",
  },
  {
    id: "btc",
    name: "Bitcoin (BTC)",
    ticker: "BTC",
    category: "crypto",
    badge: "Decentralized Digital Asset & Network",
    description:
      "Bitcoin is the first decentralized digital currency, operating on a peer-to-peer proof-of-work blockchain ledger without central banks or intermediaries. It is widely considered digital gold.",
    founded: "2009 (Genesis Block)",
    headquarters: "Decentralized Global Network",
    leadership: "Satoshi Nakamoto (Pseudonymous Creator)",
    marketCap: "$1.90 Trillion",
    keyProducts: ["Bitcoin Core", "Lightning Network", "Proof of Work Ledger", "UTXO Consensus"],
    website: "https://bitcoin.org",
    accentColor: "#f59e0b",
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "framework",
    badge: "Production React & Fullstack Framework",
    description:
      "Next.js is the premier React framework for the web, used by top global enterprises. It provides server components, streaming SSR, API routes, Turbopack bundling, and seamless Vercel edge deployment.",
    founded: "2016 (Vercel)",
    headquarters: "San Francisco, CA (Vercel Inc.)",
    leadership: "Guillermo Rauch & Tim Neutkens",
    keyProducts: ["App Router & Server Actions", "Turbopack Rust Bundler", "React Server Components (RSC)", "Next/Image & Next/Font"],
    website: "https://nextjs.org",
    accentColor: "#ffffff",
  },
  {
    id: "python",
    name: "Python",
    category: "framework",
    badge: "Universal AI & High-Level Language",
    description:
      "Python is an interpreted, high-level, general-purpose programming language. Its comprehensive standard library and rich data science ecosystem (PyTorch, TensorFlow, NumPy, FastAPI) make it the undisputed language of artificial intelligence.",
    founded: "1991 (Centrum Wiskunde & Informatica)",
    headquarters: "Python Software Foundation",
    leadership: "Guido van Rossum (Creator) & PSF Council",
    keyProducts: ["CPython 3.12/3.13", "PyTorch / TorchVision", "FastAPI / Pydantic", "NumPy / Pandas"],
    website: "https://www.python.org",
    accentColor: "#3b82f6",
  },
];

// ─── Smart Entity Matching Engine ────────────────────────────────────────────
export function detectEntity(query: string): KnowledgeEntity | null {
  if (!query || !query.trim()) return null;
  const q = query.trim().toLowerCase();

  for (const entity of KNOWLEDGE_ENTITIES) {
    // Exact ID match
    if (q === entity.id) return entity;
    // Exact Ticker match
    if (entity.ticker && q === entity.ticker.toLowerCase()) return entity;
    // Name exact or substring match
    const cleanName = entity.name.toLowerCase();
    if (q === cleanName) return entity;
    
    // Multi-word / synonym triggers
    if (entity.id === "nvda" && (q.includes("nvidia") || q === "nvda")) return entity;
    if (entity.id === "aapl" && (q.includes("apple") || q === "aapl" || q.includes("iphone"))) return entity;
    if (entity.id === "msft" && (q.includes("microsoft") || q === "msft" || q.includes("copilot"))) return entity;
    if (entity.id === "tsla" && (q.includes("tesla") || q === "tsla" || q.includes("elon musk"))) return entity;
    if (entity.id === "googl" && (q.includes("google") || q === "googl" || q === "goog" || q.includes("alphabet"))) return entity;
    if (entity.id === "amzn" && (q.includes("amazon") || q === "amzn" || q === "aws")) return entity;
    if (entity.id === "meta" && (q.includes("meta") || q === "meta platforms" || q.includes("facebook") || q.includes("llama"))) return entity;
    if (entity.id === "openai" && (q.includes("openai") || q.includes("chatgpt") || q === "gpt" || q.includes("sam altman"))) return entity;
    if (entity.id === "anthropic" && (q.includes("anthropic") || q.includes("claude"))) return entity;
    if (entity.id === "deepseek" && (q.includes("deepseek") || q.includes("deep seek"))) return entity;
    if (entity.id === "deepmind" && (q.includes("deepmind") || q.includes("demis hassabis") || q.includes("alphafold"))) return entity;
    if (entity.id === "btc" && (q.includes("bitcoin") || q === "btc" || q.includes("crypto"))) return entity;
    if (entity.id === "nextjs" && (q.includes("nextjs") || q.includes("next.js") || q === "next js")) return entity;
    if (entity.id === "python" && (q.includes("python") || q === "py")) return entity;
  }

  return null;
}

// ─── Knowledge Card Component ────────────────────────────────────────────────
interface KnowledgeCardProps {
  entity: KnowledgeEntity;
  onFilterNews?: () => void;
}

export default function KnowledgeCard({ entity, onFilterNews }: KnowledgeCardProps) {
  const [stockQuote, setStockQuote] = useState<{
    price: number;
    change: number;
    change_percent: number;
    day_high?: number;
    day_low?: number;
    volume?: number;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Fetch real-time stock quote if ticker exists
  useEffect(() => {
    if (!entity.ticker) return;

    let isMounted = true;
    setLoadingQuote(true);

    async function fetchQuote() {
      try {
        const res = await fetch(`${API_BASE_URL}/stock/?symbol=${entity.ticker}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.price) {
            setStockQuote(data);
          }
        }
      } catch (err) {
        console.warn("KnowledgeCard: live stock fetch failed:", err);
      } finally {
        if (isMounted) setLoadingQuote(false);
      }
    }

    fetchQuote();
    return () => {
      isMounted = false;
    };
  }, [entity.ticker]);

  // Handler: Trigger AI Assistant deep-dive on this entity
  const triggerAiBriefing = () => {
    const prompt = `Give me an executive, up-to-date briefing on ${entity.name}. Outline its core technology architecture, latest breakthroughs, financial/market standing, and future strategic outlook.`;
    window.dispatchEvent(new CustomEvent("ak-set-chat-prompt", { detail: { prompt } }));
    window.dispatchEvent(
      new CustomEvent("ak-add-notification", {
        detail: {
          type: "info",
          title: "AI Knowledge Briefing",
          message: `Generated instant research prompt for ${entity.name}.`,
        },
      })
    );
  };

  // Handler: Navigate to Stocks tab
  const navigateToStocks = () => {
    window.dispatchEvent(new CustomEvent("ak-navigate-tab", { detail: { tab: "stocks" } }));
  };

  const isPositive = stockQuote ? stockQuote.change >= 0 : true;
  const accentColor = entity.accentColor || "#22d3ee";

  return (
    <div
      style={{
        marginBottom: "20px",
        borderRadius: "18px",
        background: "linear-gradient(145deg, var(--bg-surface, #0f172a) 0%, rgba(15,23,42,0.6) 100%)",
        border: `1px solid color-mix(in srgb, ${accentColor} 30%, var(--border-light))`,
        boxShadow: `0 12px 36px -10px color-mix(in srgb, ${accentColor} 12%, rgba(0,0,0,0.5))`,
        padding: "22px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Ambient Glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: "10%",
          width: "280px",
          height: "140px",
          background: `radial-gradient(ellipse at top right, color-mix(in srgb, ${accentColor} 15%, transparent), transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header Row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "14px",
              background: `color-mix(in srgb, ${accentColor} 14%, var(--bg-surface))`,
              border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {entity.category === "stock" || entity.category === "crypto" ? (
              <DollarSign size={22} style={{ color: accentColor }} />
            ) : entity.category === "ai_company" ? (
              <Cpu size={22} style={{ color: accentColor }} />
            ) : (
              <Code2 size={22} style={{ color: accentColor }} />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                {entity.name}
              </h2>
              {entity.ticker && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid var(--border-light)",
                    color: "var(--text-secondary)",
                    fontFamily: "monospace",
                  }}
                >
                  {entity.exchange}: {entity.ticker}
                </span>
              )}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#38bdf8",
                  background: "rgba(56,189,248,0.1)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  padding: "2px 7px",
                  borderRadius: "6px",
                }}
              >
                <ShieldCheck size={12} /> Verified Entity
              </span>
            </div>

            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              {entity.badge}
            </p>
          </div>
        </div>

        {/* Live Stock Quote Pill (If ticker exists) */}
        {entity.ticker && stockQuote && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              background: isPositive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${isPositive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              padding: "8px 14px",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                ${stockQuote.price.toFixed(2)}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: isPositive ? "#22c55e" : "#ef4444",
                }}
              >
                {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {isPositive ? "+" : ""}
                {stockQuote.change.toFixed(2)} ({isPositive ? "+" : ""}
                {stockQuote.change_percent.toFixed(2)}%)
              </span>
            </div>
            {stockQuote.day_high && stockQuote.day_low && (
              <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                Range: ${stockQuote.day_low.toFixed(2)} – ${stockQuote.day_high.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <p
        style={{
          margin: "14px 0 16px",
          fontSize: "13.5px",
          lineHeight: "1.65",
          color: "var(--text-secondary)",
        }}
      >
        {entity.description}
      </p>

      {/* Key Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        {entity.leadership && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--bg-secondary, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-light)",
            }}
          >
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Leadership
            </span>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
              {entity.leadership}
            </span>
          </div>
        )}

        {entity.marketCap && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--bg-secondary, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-light)",
            }}
          >
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Market Valuation
            </span>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#38bdf8" }}>
              {entity.marketCap}
            </span>
          </div>
        )}

        {entity.headquarters && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--bg-secondary, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-light)",
            }}
          >
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Headquarters
            </span>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
              {entity.headquarters}
            </span>
          </div>
        )}

        {entity.founded && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--bg-secondary, rgba(255,255,255,0.03))",
              border: "1px solid var(--border-light)",
            }}
          >
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Founded
            </span>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
              {entity.founded}
            </span>
          </div>
        )}
      </div>

      {/* Flagship Products / Architectures */}
      {entity.keyProducts && entity.keyProducts.length > 0 && (
        <div style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Key Systems:
          </span>
          {entity.keyProducts.map((prod, idx) => (
            <span
              key={idx}
              style={{
                fontSize: "11.5px",
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: "6px",
                background: "color-mix(in srgb, var(--accent-primary, #22d3ee) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-primary, #22d3ee) 22%, transparent)",
                color: "var(--accent-primary, #22d3ee)",
              }}
            >
              {prod}
            </span>
          ))}
        </div>
      )}

      {/* Action Dock */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-light)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={triggerAiBriefing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 16px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
            color: "#030f1a",
            fontWeight: 800,
            fontSize: "12.5px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(34,211,238,0.25)",
            transition: "all 0.18s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <Sparkles size={14} /> Ask AI Deep-Dive
        </button>

        {entity.ticker && (
          <button
            type="button"
            onClick={navigateToStocks}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-light)",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: "12.5px",
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#38bdf8")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
          >
            <BarChart2 size={14} style={{ color: "#38bdf8" }} /> Open Stock Center
          </button>
        )}

        {onFilterNews && (
          <button
            type="button"
            onClick={onFilterNews}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-light)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "12.5px",
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
          >
            📰 Search Breaking News
          </button>
        )}

        {entity.website && (
          <a
            href={entity.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              marginLeft: "auto",
              color: "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Globe size={13} /> Official Website <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
