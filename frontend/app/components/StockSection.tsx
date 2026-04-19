"use client";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
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

function Sparkline({ data, isPos }: { data?: number[], isPos: boolean }) {
  if (!data || data.length < 2) return <div style={{ width: 40, height: 18 }} />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 40;
  const height = 18;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const color = isPos ? "#34d399" : "#f87171";
  
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 2px 4px ${color}80)` }}
      />
    </svg>
  );
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
  if (!v) return "";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export default function StockSection() {
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

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

  // ── Auto-refresh every 2 minutes ──────────────────────────────────
  const { countdown, isRefreshing, triggerRefresh } = useAutoRefresh({
    intervalSeconds: 120,
    onRefresh: async () => {
      await fetchStocks();
      // Only show toast if data actually loaded successfully
      showToast("success", "Stock prices updated! 📈");
    },
    refreshOnMount: true,   // fetch immediately on load
  });

  useEffect(() => { /* fetchStocks called by useAutoRefresh on mount */ }, []);

  if (loading) {
    return (
      <div className="space-y-1 pt-1">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton h-7 rounded-md" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Could not load stocks</p>
        <button type="button" onClick={fetchStocks}
          className="btn btn-secondary text-xs" style={{ padding: "4px 12px" }}>
          <RefreshCw className="w-3 h-3 inline mr-1" />Retry
        </button>
      </div>
    );
  }

  const stockMap = Object.fromEntries(data.stocks.map((s) => [s.symbol, s]));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data.cached ? "Cached" : "Live"} · {data.stocks.filter(s => !s.error).length} stocks · {lastUpdated}
        </p>
        {/* Countdown + manual refresh button */}
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
          style={{
            color: "var(--text-muted)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: isRefreshing ? "wait" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-primary)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          title="Click to refresh now"
        >
          <RefreshCw
            className="w-3 h-3"
            style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : "none" }}
          />
          <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
            {isRefreshing ? "Refreshing…" : `⟳ ${countdown}`}
          </span>
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid flex-shrink-0 mb-1 px-2"
        style={{ gridTemplateColumns: "52px 1fr 68px 52px", gap: "4px" }}
      >
        {["Symbol", "Name", "Change", "Price"].map((h) => (
          <span key={h} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</span>
        ))}
      </div>

      {/* Scrollable stock list grouped by sector */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {Object.entries(data.sectors).map(([sector, symbols]) => {
          const sectorStocks = symbols.map((sym) => stockMap[sym]).filter(Boolean);
          if (!sectorStocks.length) return null;

          return (
            <div key={sector} className="mb-2">
              {/* Sector label */}
              <p
                className="text-xs font-bold px-2 py-0.5 mb-0.5 sticky top-0"
                style={{
                  color: "var(--accent-primary)",
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontSize: "0.65rem",
                }}
              >
                {sector}
              </p>

              {/* Stocks */}
              {sectorStocks.map((s) => {
                if (s.error) {
                  return (
                    <div
                      key={s.symbol}
                      className="grid px-2 py-1 rounded items-center"
                      style={{ gridTemplateColumns: "52px 1fr 40px 60px 48px", gap: "4px", opacity: 0.4 }}
                    >
                      <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{s.symbol}</span>
                      <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>—</span>
                      <span className="text-xs"></span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>N/A</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                    </div>
                  );
                }

                const isPos = (s.change_percent ?? 0) >= 0;
                const pctStr = formatChange(s.change_percent);

                return (
                  <div
                    key={s.symbol}
                    className="grid px-2 py-1 rounded items-center"
                    style={{
                      gridTemplateColumns: "52px 1fr 40px 60px 48px",
                      gap: "4px",
                      transition: "background 0.12s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Symbol */}
                    <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {s.symbol}
                    </span>

                    {/* Short name */}
                    <span className="text-xs truncate" style={{ color: "var(--text-muted)" }} title={s.name}>
                      {s.name?.replace(/ Inc\.?| Corp\.?| Ltd\.?/gi, "") ?? ""}
                    </span>

                    {/* Sparkline */}
                    <div className="flex items-center justify-center">
                      <Sparkline data={s.history} isPos={isPos} />
                    </div>

                    {/* Change % badge */}
                    <div
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded-full justify-center"
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        background: isPos ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: isPos ? "#34d399" : "#f87171",
                        border: `1px solid ${isPos ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                      }}
                    >
                      {isPos
                        ? <TrendingUp className="w-2.5 h-2.5 flex-shrink-0" />
                        : <TrendingDown className="w-2.5 h-2.5 flex-shrink-0" />}
                      {pctStr}
                    </div>

                    {/* Price */}
                    <span
                      className="text-xs font-bold text-right"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatPrice(s.price)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
