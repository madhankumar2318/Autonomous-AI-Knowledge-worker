"use client";
import { Activity, BarChart2, RefreshCw, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { showToast } from "./Toast";

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

interface StockResponse {
  stocks: StockQuote[];
  cached: boolean;
  sectors: Record<string, string[]>;
}

function formatPrice(p?: number | null) {
  if (p == null) return "—";
  return `$${p.toFixed(2)}`;
}

function formatChange(pct?: number) {
  if (pct == null) return "0.00%";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatVolume(v?: number) {
  if (!v) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

function Sparkline({ data, isPos, width = 80, height = 28 }: { data?: number[]; isPos: boolean; width?: number; height?: number }) {
  if (!data || data.length < 2)
    return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");

  // fill path
  const firstX = 0;
  const firstY = height - 2 - ((data[0] - min) / range) * (height - 4);
  const lastX = width;
  const lastY = height - 2 - ((data[data.length - 1] - min) / range) * (height - 4);
  const fillPath = `M${firstX},${firstY} ${data.map((val, i) => { const x = (i / (data.length - 1)) * width; const y = height - 2 - ((val - min) / range) * (height - 4); return `L${x},${y}`; }).join(" ")} L${lastX},${height + 2} L${firstX},${height + 2} Z`;

  const color = isPos ? "#34d399" : "#f87171";
  const fillColor = isPos ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <title>Stock price trend</title>
      <path d={fillPath} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 1px 3px ${color}80)` }}
      />
    </svg>
  );
}

// Sector accent colors
const SECTOR_COLORS: Record<string, { color: string; bg: string }> = {
  "Technology": { color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  "Finance": { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "Healthcare": { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "Energy": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  "Consumer": { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "Index": { color: "#22d3ee", bg: "rgba(34,211,238,0.1)" },
  default: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

function getSectorStyle(sector: string) {
  return SECTOR_COLORS[sector] || SECTOR_COLORS.default;
}

export default function StockSection({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("All");

  const fetchStocks = () => {
    setLoading(true);
    return fetch("http://127.0.0.1:8000/stock/multiple")
      .then((r) => r.json())
      .then((d: StockResponse) => {
        setData(d);
        setLastUpdated(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const { countdown, isRefreshing, triggerRefresh } = useAutoRefresh({
    intervalSeconds: 120,
    onRefresh: async () => {
      await fetchStocks();
      showToast("success", "Stock prices updated! 📈");
    },
    refreshOnMount: true,
  });

  // ── COMPACT HOME-VIEW MODE (Top 6 Stocks) ──
  if (compact) {
    if (loading) {
      return (
        <div className="space-y-1 pt-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-7 rounded-md" />
          ))}
        </div>
      );
    }
    if (!data) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {data.stocks.slice(0, 6).filter(s => !s.error).map((s) => {
          const isPos = (s.change_percent ?? 0) >= 0;
          return (
            <div key={s.symbol} style={{ display: "grid", gridTemplateColumns: "48px 1fr 50px 50px", gap: "6px", padding: "6px 8px", borderRadius: "8px", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>{s.symbol}</span>
              <Sparkline data={s.history} isPos={isPos} width={50} height={18} />
              <span style={{ fontSize: "10px", fontWeight: 700, color: isPos ? "#34d399" : "#f87171", textAlign: "right" }}>{formatChange(s.change_percent)}</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>{formatPrice(s.price)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── FULL TAB MODE ──
  if (loading) {
    return (
      <div className="stocks-root">
        <div className="stocks-skeleton-bar skeleton" />
        <div className="stocks-skeleton-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="stocks-skeleton-card skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stocks-error">
        <BarChart2 className="w-10 h-10 text-white/20" />
        <p>Could not load market data</p>
        <button type="button" onClick={fetchStocks} className="btn btn-secondary text-xs">
          <RefreshCw className="w-3 h-3 inline mr-1" /> Retry
        </button>
      </div>
    );
  }

  const stockMap = Object.fromEntries(data.stocks.map((s) => [s.symbol, s]));
  const allSectors = ["All", ...Object.keys(data.sectors)];

  // Market summary stats
  const validStocks = data.stocks.filter((s) => !s.error);
  const gainers = validStocks.filter((s) => (s.change_percent ?? 0) > 0).length;
  const losers = validStocks.filter((s) => (s.change_percent ?? 0) < 0).length;
  const avgChange = validStocks.reduce((sum, s) => sum + (s.change_percent ?? 0), 0) / (validStocks.length || 1);
  const marketSentiment = avgChange > 0 ? "Bullish" : avgChange < 0 ? "Bearish" : "Neutral";

  return (
    <div className="stocks-root">
      {/* ── MARKET OVERVIEW BAR ── */}
      <div className="stocks-overview">
        <div className="stocks-overview-stat">
          <div className="stocks-overview-icon" style={{ background: "rgba(34,211,238,0.12)", borderColor: "rgba(34,211,238,0.25)" }}>
            <Activity className="w-4 h-4" style={{ color: "#22d3ee" }} />
          </div>
          <div>
            <div className="stocks-overview-label">Market Sentiment</div>
            <div className="stocks-overview-value" style={{ color: avgChange >= 0 ? "#34d399" : "#f87171" }}>
              {marketSentiment}
            </div>
          </div>
        </div>
        <div className="stocks-overview-divider" />
        <div className="stocks-overview-stat">
          <div className="stocks-overview-icon" style={{ background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.25)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#34d399" }} />
          </div>
          <div>
            <div className="stocks-overview-label">Gainers</div>
            <div className="stocks-overview-value" style={{ color: "#34d399" }}>{gainers}</div>
          </div>
        </div>
        <div className="stocks-overview-divider" />
        <div className="stocks-overview-stat">
          <div className="stocks-overview-icon" style={{ background: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.25)" }}>
            <TrendingDown className="w-4 h-4" style={{ color: "#f87171" }} />
          </div>
          <div>
            <div className="stocks-overview-label">Losers</div>
            <div className="stocks-overview-value" style={{ color: "#f87171" }}>{losers}</div>
          </div>
        </div>
        <div className="stocks-overview-divider" />
        <div className="stocks-overview-stat">
          <div className="stocks-overview-icon" style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}>
            <Zap className="w-4 h-4" style={{ color: "#818cf8" }} />
          </div>
          <div>
            <div className="stocks-overview-label">Avg Change</div>
            <div className="stocks-overview-value" style={{ color: avgChange >= 0 ? "#34d399" : "#f87171" }}>
              {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Right: refresh */}
        <div className="stocks-overview-right">
          <span className="stocks-live-indicator">
            <span className="stocks-live-dot" />
            {data.cached ? "Cached" : "Live"}
          </span>
          <span className="stocks-last-updated">{lastUpdated}</span>
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className="stocks-refresh-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Refreshing…" : countdown}</span>
          </button>
        </div>
      </div>

      {/* ── SECTOR FILTER PILLS ── */}
      <div className="stocks-sector-pills">
        {allSectors.map((sector) => {
          const style = getSectorStyle(sector);
          return (
            <button
              key={sector}
              type="button"
              onClick={() => setSelectedSector(sector)}
              className={`stocks-sector-pill ${selectedSector === sector ? "stocks-sector-active" : ""}`}
              style={selectedSector === sector ? { background: style.bg, borderColor: `${style.color}60`, color: style.color } : undefined}
            >
              {sector}
            </button>
          );
        })}
      </div>

      {/* ── STOCK BENTO GRID ── */}
      {Object.entries(data.sectors).map(([sector, symbols]) => {
        if (selectedSector !== "All" && selectedSector !== sector) return null;
        const sectorStocks = symbols.map((sym) => stockMap[sym]).filter(Boolean).filter(s => !s.error);
        if (!sectorStocks.length) return null;
        const sectorStyle = getSectorStyle(sector);

        return (
          <div key={sector} className="stocks-sector-block">
            <div className="stocks-sector-header">
              <span className="stocks-sector-tag" style={{ background: sectorStyle.bg, borderColor: `${sectorStyle.color}40`, color: sectorStyle.color }}>
                {sector}
              </span>
              <span className="stocks-sector-count">{sectorStocks.length} stocks</span>
              <div className="stocks-sector-line" />
            </div>

            <div className="stocks-bento-grid">
              {sectorStocks.map((s) => {
                const isPos = (s.change_percent ?? 0) >= 0;
                const pctStr = formatChange(s.change_percent);

                return (
                  <div
                    key={s.symbol}
                    className="stocks-card"
                    style={{ "--stock-color": isPos ? "#34d399" : "#f87171" } as React.CSSProperties}
                  >
                    {/* Card top: symbol + trend badge */}
                    <div className="stocks-card-header">
                      <div>
                        <div className="stocks-card-symbol">{s.symbol}</div>
                        <div className="stocks-card-name">
                          {s.name?.replace(/ Inc\.?| Corp\.?| Ltd\.?/gi, "") ?? ""}
                        </div>
                      </div>
                      <div
                        className="stocks-change-badge"
                        style={{
                          background: isPos ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                          borderColor: isPos ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)",
                          color: isPos ? "#34d399" : "#f87171",
                        }}
                      >
                        {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {pctStr}
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="stocks-card-sparkline">
                      <Sparkline data={s.history} isPos={isPos} width={100} height={32} />
                    </div>

                    {/* Price + volume */}
                    <div className="stocks-card-footer">
                      <div className="stocks-card-price" style={{ color: isPos ? "#34d399" : "#f87171" }}>
                        {formatPrice(s.price)}
                      </div>
                      {s.volume && (
                        <div className="stocks-card-vol">
                          <span className="stocks-card-vol-label">Vol</span>
                          {formatVolume(s.volume)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <style>{`
        .stocks-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          flex: 1;
          min-height: 0;
          height: 100%;
          max-height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-right: 4px;
          padding-bottom: 24px;
          scrollbar-gutter: stable;
        }

        /* ── OVERVIEW BAR ── */
        .stocks-overview {
          display: flex;
          align-items: center;
          gap: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          padding: 14px 20px;
          flex-wrap: wrap;
          row-gap: 12px;
        }
        .stocks-overview-stat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px;
        }
        .stocks-overview-stat:first-child { padding-left: 0; }
        .stocks-overview-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stocks-overview-label {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1;
          margin-bottom: 3px;
        }
        .stocks-overview-value {
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
        }
        .stocks-overview-divider {
          width: 1px;
          height: 36px;
          background: var(--border-light);
        }
        .stocks-overview-right {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
          padding-left: 20px;
        }
        .stocks-live-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          color: #34d399;
        }
        .stocks-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80; }
          50% { opacity: 0.5; box-shadow: 0 0 2px #4ade80; }
        }
        .stocks-last-updated {
          font-size: 12px;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .stocks-refresh-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          font-variant-numeric: tabular-nums;
        }
        .stocks-refresh-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .stocks-refresh-btn:disabled { opacity: 0.5; cursor: wait; }

        /* ── SECTOR PILLS ── */
        .stocks-sector-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .stocks-sector-pill {
          padding: 5px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid var(--border-light);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .stocks-sector-pill:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .stocks-sector-active {
          font-weight: 700;
        }

        /* ── SECTOR BLOCK ── */
        .stocks-sector-block { display: flex; flex-direction: column; gap: 12px; }
        .stocks-sector-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .stocks-sector-tag {
          font-size: 12px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .stocks-sector-count {
          font-size: 12px;
          color: var(--text-muted);
        }
        .stocks-sector-line {
          flex: 1;
          height: 1px;
          background: var(--border-light);
        }

        /* ── BENTO GRID ── */
        .stocks-bento-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
        }

        /* ── STOCK CARD ── */
        .stocks-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          border-radius: 14px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          transition: all 0.18s ease;
          position: relative;
          overflow: hidden;
        }
        .stocks-card::before {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--stock-color);
          opacity: 0.3;
          border-radius: 0 0 14px 14px;
        }
        .stocks-card:hover {
          background: var(--bg-hover);
          border-color: var(--border-medium);
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.3);
        }
        .stocks-card:hover::before { opacity: 0.7; }

        .stocks-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 6px;
        }
        .stocks-card-symbol {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: 0.3px;
          line-height: 1;
        }
        .stocks-card-name {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 80px;
        }
        .stocks-change-badge {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 13px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 6px;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .stocks-card-sparkline {
          overflow: hidden;
        }
        .stocks-card-footer {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 6px;
        }
        .stocks-card-price {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.3px;
        }
        .stocks-card-vol {
          font-size: 12px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .stocks-card-vol-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }

        /* ── SKELETON ── */
        .stocks-skeleton-bar { height: 72px; border-radius: 16px; margin-bottom: 4px; }
        .stocks-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
        }
        .stocks-skeleton-card { height: 120px; border-radius: 14px; }

        /* ── ERROR ── */
        .stocks-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 64px 24px;
          text-align: center;
          color: var(--text-muted);
          font-size: 15px;
        }
      `}</style>
    </div>
  );
}
