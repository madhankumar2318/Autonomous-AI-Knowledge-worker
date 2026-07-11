"use client";
import React, { useEffect, useState, useRef } from "react";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Newspaper, 
  Cpu, 
  Zap, 
  ShoppingBag, 
  DollarSign, 
  Globe, 
  RefreshCw, 
  ExternalLink,
  LayoutDashboard
} from "lucide-react";
import { API_BASE_URL } from "../config";

interface StockQuote {
  symbol: string;
  name?: string;
  price?: number | null;
  change?: number;
  change_percent?: number;
  volume?: number;
  error?: string;
  history?: number[];
}

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage?: string;
  publishedAt?: string;
  summary?: string;
  source?: string;
}

// Sparkline helper component
function Sparkline({ data, isPos }: { data?: number[]; isPos: boolean }) {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 20 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 70;
  const height = 22;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");

  const color = isPos ? "#10b981" : "#ef4444";
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LiveDashboard() {
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [sectors, setSectors] = useState<Record<string, string[]>>({});
  const [news, setNews] = useState<Article[]>([]);
  
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws/live";
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      setWsConnecting(true);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        setWsConnecting(false);
        ws?.send(JSON.stringify({ type: "subscribe", channels: ["stocks", "news"] }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const timestamp = new Date().toLocaleTimeString();
          
          if (msg.type === "stocks") {
            const newStocks: StockQuote[] = msg.data.stocks || [];
            
            // Calculate flashing states for price updates
            const newFlashes: Record<string, "up" | "down" | null> = {};
            for (const s of newStocks) {
              if (s.price != null && s.symbol) {
                const prevPrice = prevPricesRef.current[s.symbol];
                if (prevPrice != null && prevPrice !== s.price) {
                  newFlashes[s.symbol] = s.price > prevPrice ? "up" : "down";
                }
                prevPricesRef.current[s.symbol] = s.price;
              }
            }
            
            if (Object.keys(newFlashes).length > 0) {
              setFlashStates((prev) => ({ ...prev, ...newFlashes }));
              // Reset flash state after 1 second
              setTimeout(() => {
                setFlashStates((prev) => {
                  const restored = { ...prev };
                  for (const sym of Object.keys(newFlashes)) {
                    restored[sym] = null;
                  }
                  return restored;
                });
              }, 1000);
            }

            setStocks(newStocks);
            if (msg.data.sectors) setSectors(msg.data.sectors);
            setLastUpdated(timestamp);
          } else if (msg.type === "news") {
            setNews(msg.data.news || []);
            setLastUpdated(timestamp);
          }
        } catch (e) {
          console.error("[WS] Error parsing live message:", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setWsConnecting(true);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("[WS] Connection error:", err);
        ws?.close();
      };
    }

    connect();

    // Trigger initial REST fetches in case WS streams are quiet
    fetch(`${API_BASE_URL}/stock/multiple`)
      .then((r) => r.json())
      .then((d) => {
        setStocks(d.stocks || []);
        setSectors(d.sectors || {});
        for (const s of (d.stocks || [])) {
          if (s.price != null && s.symbol) {
            prevPricesRef.current[s.symbol] = s.price;
          }
        }
      })
      .catch((e) => console.error("Initial stocks fetch error:", e));

    fetch(`${API_BASE_URL}/news`)
      .then((r) => r.json())
      .then((d) => setNews(d.news || []))
      .catch((e) => console.error("Initial news fetch error:", e));

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Calculate sector metrics based on stocks in each sector
  const getSectorPerformance = (sectorName: string) => {
    const symbols = sectors[sectorName] || [];
    if (symbols.length === 0) return { change: 0, isPos: true };
    
    let totalChange = 0;
    let count = 0;
    for (const sym of symbols) {
      const match = stocks.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
      if (match && match.change_percent != null) {
        totalChange += match.change_percent;
        count++;
      }
    }
    const avg = count > 0 ? totalChange / count : 0;
    return { change: avg, isPos: avg >= 0 };
  };

  // Helper to format source tag colors
  const getSourceStyle = (source?: string) => {
    const lower = source?.toLowerCase() || "";
    if (lower.includes("reuters")) return { bg: "rgba(249,115,22,0.12)", color: "#f97316" };
    if (lower.includes("bloomberg")) return { bg: "rgba(236,72,153,0.12)", color: "#ec4899" };
    if (lower.includes("techcrunch")) return { bg: "rgba(16,185,129,0.12)", color: "#10b981" };
    if (lower.includes("cnn") || lower.includes("bbc")) return { bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
    return { bg: "rgba(34,211,238,0.12)", color: "#22d3ee" };
  };

  const tickerStocks = stocks.filter(s => !s.error && s.price != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", color: "#e2e8f0", paddingBottom: "24px" }}>
      {/* Ticker Keyframes Injector */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .live-ticker-container:hover .live-ticker-inner {
          animation-play-state: paused;
        }
      `}</style>

      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99, 102, 241, 0.15)", borderRadius: "8px", width: "36px", height: "36px" }}>
            <LayoutDashboard size={20} style={{ color: "#6366f1" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#fff" }}>Live Overview</h2>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Real-time synchronized market analytics & headlines</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {lastUpdated && (
            <span style={{ fontSize: "11px", color: "#64748b" }}>Updated: {lastUpdated}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px" }}>
            <span style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: wsConnected ? "#10b981" : "#f59e0b",
              boxShadow: wsConnected ? "0 0 8px #10b981" : "0 0 8px #f59e0b"
            }} />
            <span style={{ fontWeight: 600, color: wsConnected ? "#34d399" : "#fbbf24" }}>
              {wsConnected ? "Live Connected" : (wsConnecting ? "Connecting..." : "Offline")}
            </span>
          </div>
        </div>
      </div>

      {/* Infinite scrolling ticker */}
      {tickerStocks.length > 0 && (
        <div className="live-ticker-container" style={{ overflow: "hidden", width: "100%", background: "rgba(30, 41, 59, 0.3)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "8px 0" }}>
          <div className="live-ticker-inner" style={{
            display: "flex",
            width: "max-content",
            animation: "marquee 45s linear infinite"
          }}>
            {/* Double copies to allow infinite wrap-around */}
            {[...Array(2)].map((_, copyIdx) => (
              <div key={copyIdx} style={{ display: "flex", gap: "30px", paddingRight: "30px" }}>
                {tickerStocks.map((s, idx) => {
                  const isPos = (s.change_percent ?? 0) >= 0;
                  const flash = flashStates[s.symbol];
                  let flashBg = "transparent";
                  if (flash === "up") flashBg = "rgba(16, 185, 129, 0.15)";
                  if (flash === "down") flashBg = "rgba(239, 68, 68, 0.15)";

                  return (
                    <div 
                      key={`${copyIdx}-${s.symbol}-${idx}`} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        fontSize: "12px", 
                        fontWeight: 650,
                        background: flashBg,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        transition: "background 0.25s ease"
                      }}
                    >
                      <span style={{ color: "#fff" }}>{s.symbol}</span>
                      <span style={{ color: "#94a3b8", fontWeight: 400 }}>${s.price?.toFixed(2)}</span>
                      <span style={{ color: isPos ? "#34d399" : "#f87171", display: "flex", alignItems: "center", gap: "2px" }}>
                        {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {isPos ? "+" : ""}{s.change_percent?.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sector metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {[
          { name: "Technology", icon: Cpu, accent: "#818cf8" },
          { name: "Finance", icon: DollarSign, accent: "#34d399" },
          { name: "Healthcare", icon: Activity, accent: "#f472b6" },
          { name: "Energy", icon: Zap, accent: "#fbbf24" },
          { name: "Consumer", icon: ShoppingBag, accent: "#60a5fa" }
        ].map((sector) => {
          const perf = getSectorPerformance(sector.name);
          const SecIcon = sector.icon;
          return (
            <div 
              key={sector.name} 
              style={{ 
                background: "rgba(15, 23, 42, 0.25)", 
                border: "1px solid rgba(255, 255, 255, 0.04)", 
                borderRadius: "10px", 
                padding: "12px 14px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{sector.name.toUpperCase()}</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: perf.isPos ? "#34d399" : "#f87171" }}>
                  {perf.change >= 0 ? "+" : ""}{perf.change.toFixed(2)}%
                </span>
              </div>
              <div style={{ background: sector.accent + "20", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SecIcon size={14} style={{ color: sector.accent }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main dashboard splits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        
        {/* Watchlist card */}
        <div style={{ background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", display: "flex", flexDirection: "column" }}>
          <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={16} style={{ color: "#34d399" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 650, margin: 0 }}>Market Watchlist</h3>
            </div>
            <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "4px", padding: "2px 6px" }}>{stocks.length} tracked</span>
          </div>

          <div style={{ overflowY: "auto", maxHeight: "400px", padding: "8px" }}>
            {stocks.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                Loading live stock tickers...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {stocks.map((s) => {
                  if (s.error) return null;
                  const isPos = (s.change_percent ?? 0) >= 0;
                  const flash = flashStates[s.symbol];
                  let flashBg = "transparent";
                  if (flash === "up") flashBg = "rgba(16, 185, 129, 0.1)";
                  if (flash === "down") flashBg = "rgba(239, 68, 68, 0.1)";

                  return (
                    <div 
                      key={s.symbol} 
                      style={{ 
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: flashBg,
                        border: "1px solid transparent",
                        transition: "all 0.25s ease"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{s.symbol}</span>
                        <span style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>{s.name}</span>
                      </div>
                      
                      <div style={{ justifySelf: "end" }}>
                        <Sparkline data={s.history} isPos={isPos} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 650, color: "#f8fafc" }}>${s.price?.toFixed(2)}</span>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>Vol: {s.volume ? `${(s.volume/1e6).toFixed(1)}M` : "—"}</span>
                      </div>

                      <div style={{ 
                        background: isPos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                        border: `1px solid ${isPos ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`,
                        color: isPos ? "#34d399" : "#f87171",
                        fontSize: "11px",
                        fontWeight: 650,
                        borderRadius: "5px",
                        padding: "3px 6px",
                        minWidth: "60px",
                        textAlign: "right"
                      }}>
                        {isPos ? "+" : ""}{s.change_percent?.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Breaking News Card */}
        <div style={{ background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px", display: "flex", flexDirection: "column" }}>
          <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Newspaper size={16} style={{ color: "#22d3ee" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 650, margin: 0 }}>Live Headline News</h3>
            </div>
            <span style={{ fontSize: "11px", color: "#22d3ee", display: "flex", alignItems: "center", gap: "4px" }}>
              <Globe size={11} /> Global Feed
            </span>
          </div>

          <div style={{ overflowY: "auto", maxHeight: "400px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {news.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                Loading live headlines stream...
              </div>
            ) : (
              news.map((n, i) => {
                const sStyle = getSourceStyle(n.source);
                return (
                  <a 
                    key={i} 
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      display: "flex", 
                      flexDirection: "column",
                      gap: "6px",
                      background: "rgba(255, 255, 255, 0.01)",
                      border: "1px solid rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ 
                        fontSize: "9px", 
                        fontWeight: 700, 
                        background: sStyle.bg,
                        color: sStyle.color,
                        borderRadius: "4px",
                        padding: "1px 5px",
                        textTransform: "uppercase"
                      }}>
                        {n.source || "Web"}
                      </span>
                      {n.publishedAt && (
                        <span style={{ fontSize: "10px", color: "#64748b" }}>
                          {new Date(n.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    
                    <span 
                      className="news-title"
                      style={{ 
                        fontSize: "12px", 
                        fontWeight: 650, 
                        color: "#f1f5f9", 
                        lineHeight: 1.4
                      }}
                    >
                      {n.title}
                    </span>

                    <span style={{ fontSize: "10px", color: "#94a3b8", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
                      {n.description}
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
