"use client";
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Calendar,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "../config";
import { showToast } from "./Toast";

interface StockQuote {
  symbol: string;
  name?: string;
  price?: number | null;
  change?: number;
  change_percent?: number;
  volume?: number;
  market_cap?: number;
  day_high?: number;
  day_low?: number;
  error?: string;
  history?: number[];
}

interface HistoricalPoint {
  date: string;
  price: number;
  volume?: number;
}

interface StockChartDetailProps {
  stock: StockQuote;
  onClose: () => void;
}

function formatPrice(p?: number | null) {
  if (p == null) return "—";
  return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChange(pct?: number) {
  if (pct == null) return "0.00%";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatBigNumber(num?: number) {
  if (!num) return "—";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatVolume(v?: number) {
  if (!v) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

export default function StockChartDetail({ stock, onClose }: StockChartDetailProps) {
  const [period, setPeriod] = useState<"1d" | "5d" | "1mo" | "1y">("1mo");
  const [chartData, setChartData] = useState<HistoricalPoint[]>([]);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const isPos = (stock.change_percent ?? 0) >= 0;
  const themeColor = isPos ? "#34d399" : "#f87171";
  const themeRgb = isPos ? "52,211,153" : "248,113,113";

  useEffect(() => {
    setLoading(true);
    setHoverIndex(null);
    fetch(`${API_BASE_URL}/stock/history/${stock.symbol}?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error("History fetch failed");
        return r.json();
      })
      .then((d) => {
        setChartData(d.data || []);
        if (d.details) {
          setDetails(d.details);
        }
      })
      .catch((err) => {
        console.error("Error loading history:", err);
        showToast("error", "Failed to load historical trend chart.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stock.symbol, period]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Render SVG Chart elements
  // Render SVG Chart elements
  const width = 640;
  const height = 300;
  
  const paddingLeft = 20;
  const paddingRight = 65;
  const paddingTop = 20;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const priceChartHeight = 160;
  const volumeChartHeight = 50;
  const volumeTop = paddingTop + priceChartHeight + 15;

  const prices = chartData.map((d) => d.price);
  const minVal = Math.min(...prices);
  const maxVal = Math.max(...prices);
  const valRange = maxVal - minVal || 1;

  const volumes = chartData.map((d) => d.volume ?? 0);
  const maxVolume = Math.max(...volumes) || 1;

  // Coordinate converters
  const getX = (index: number) => {
    if (chartData.length <= 1) return paddingLeft;
    return paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  };

  const getPriceY = (p: number) => {
    return paddingTop + priceChartHeight - ((p - minVal) / valRange) * priceChartHeight;
  };

  const getVolumeY = (v: number) => {
    return volumeTop + volumeChartHeight - (v / maxVolume) * volumeChartHeight;
  };

  // Generate price path coordinates (glowing line & area fill)
  const pricePoints = chartData.map((pt, i) => ({
    x: getX(i),
    y: getPriceY(pt.price),
  }));

  const pricePathD = pricePoints.length > 0
    ? `M ${pricePoints[0].x} ${pricePoints[0].y} ` + pricePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const priceAreaD = pricePoints.length > 0
    ? `${pricePathD} L ${pricePoints[pricePoints.length - 1].x} ${paddingTop + priceChartHeight} L ${pricePoints[0].x} ${paddingTop + priceChartHeight} Z`
    : "";

  // Grid tick calculations
  const priceTicks = [
    maxVal,
    minVal + valRange * 0.66,
    minVal + valRange * 0.33,
    minVal,
  ];

  // Selected date ticks (evenly spaced, max 4)
  const dateTickIndices = chartData.length > 1
    ? [
        0,
        Math.floor((chartData.length - 1) * 0.33),
        Math.floor((chartData.length - 1) * 0.66),
        chartData.length - 1,
      ]
    : [0];

  // Mouse Move calculation for hover crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartData.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, (x - (paddingLeft / rect.width) * rect.width) / ((chartWidth / rect.width) * rect.width)));
    const idx = Math.round(pct * (chartData.length - 1));
    const finalIdx = Math.max(0, Math.min(chartData.length - 1, idx));
    setHoverIndex(finalIdx);
  };

  const activePoint = hoverIndex !== null ? chartData[hoverIndex] : null;
  const hoverX = hoverIndex !== null && pricePoints[hoverIndex] ? pricePoints[hoverIndex].x : 0;
  const hoverY = hoverIndex !== null && pricePoints[hoverIndex] ? pricePoints[hoverIndex].y : 0;
  const hoverVolY = hoverIndex !== null && activePoint ? getVolumeY(activePoint.volume ?? 0) : 0;

  return (
    <div className="sc-overlay">
      <style>{`
        .sc-overlay {
          position: fixed;
          inset: 0;
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 11, 16, 0.85);
          backdrop-filter: blur(12px);
          animation: scFadeIn 0.2s ease-out;
          padding: 20px;
        }
        @keyframes scFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .sc-container {
          width: 100%;
          max-width: 660px;
          background: var(--bg-sidebar, #12141a);
          border: 1px solid var(--border-medium, rgba(255,255,255,0.08));
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 50px rgba(${themeRgb}, 0.05);
          animation: scScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
        }
        @keyframes scScaleIn {
          from { transform: scale(0.95) translateY(10px); }
          to { transform: scale(1) translateY(0); }
        }

        .sc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.05));
          background: linear-gradient(to right, rgba(${themeRgb}, 0.03), transparent);
        }
        .sc-title-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .sc-symbol-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sc-symbol {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .sc-name {
          font-size: 14px;
          color: var(--text-secondary, #94a3b8);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sc-price-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-top: 6px;
        }
        .sc-price {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          font-family: monospace;
        }
        .sc-change-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid;
        }

        .sc-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--bg-surface, rgba(255,255,255,0.03));
          border: 1px solid var(--border-light, rgba(255,255,255,0.06));
          color: var(--text-secondary, #94a3b8);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sc-close-btn:hover {
          background: var(--bg-hover, rgba(255,255,255,0.08));
          color: #fff;
        }

        .sc-tabs-row {
          display: flex;
          padding: 12px 24px;
          border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.04));
          gap: 6px;
        }
        .sc-tab {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary, #94a3b8);
          background: transparent;
          border: 1px solid transparent;
          padding: 4px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sc-tab:hover {
          color: #fff;
          background: var(--bg-hover, rgba(255,255,255,0.04));
        }
        .sc-tab-active {
          color: ${themeColor} !important;
          background: rgba(${themeRgb}, 0.08) !important;
          border-color: rgba(${themeRgb}, 0.2) !important;
        }

        .sc-chart-wrap {
          padding: 16px 20px 24px 20px;
          background: rgba(0,0,0,0.18);
          position: relative;
          height: 330px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .sc-svg-container {
          width: 100%;
          height: 100%;
          overflow: visible;
          cursor: crosshair;
        }
        
        /* Premium Floating Tooltip */
        .sc-tooltip {
          position: absolute;
          z-index: 10;
          background: rgba(18, 20, 26, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px;
          pointer-events: none;
          box-shadow: 0 12px 24px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
          transition: left 0.1s ease-out, top 0.1s ease-out;
        }
        .sc-tooltip-date {
          color: var(--text-muted, #94a3b8);
          font-size: 10px;
          font-weight: 600;
        }
        .sc-tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        
        /* Bloomberg-Style Floating Axis Labels */
        .sc-axis-label-y {
          font-size: 10px;
          font-weight: 700;
          fill: #ffffff;
        }
        .sc-axis-label-x {
          font-size: 10px;
          font-weight: 700;
          fill: #ffffff;
        }
        
        .sc-grid-label {
          font-size: 10px;
          font-family: monospace;
          fill: var(--text-muted, #475569);
          font-weight: 500;
        }


        .sc-grid-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 20px 24px;
          gap: 16px;
          background: var(--bg-secondary, #0c0e12);
        }
        .sc-stat-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sc-stat-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .sc-stat-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          font-family: monospace;
        }

        .sc-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-muted);
          height: 260px;
        }
        .sc-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(255,255,255,0.08);
          border-top-color: ${themeColor};
          border-radius: 50%;
          animation: scSpin 0.8s linear infinite;
        }
        @keyframes scSpin { to { transform: rotate(360deg); } }

        .sc-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 260px;
          color: var(--text-muted);
          font-size: 12px;
        }
      `}</style>

      <div className="sc-container">
        {/* Header */}
        <div className="sc-header">
          <div className="sc-title-block">
            <div className="sc-symbol-row">
              <span className="sc-symbol">{stock.symbol}</span>
              <span className="sc-name" title={stock.name}>{stock.name}</span>
            </div>
            <div className="sc-price-row">
              <span className="sc-price">{formatPrice(stock.price)}</span>
              <div
                className="sc-change-badge"
                style={{
                  background: isPos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                  borderColor: isPos ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)",
                  color: themeColor,
                }}
              >
                {formatChange(stock.change_percent)}
              </div>
            </div>
          </div>
          <button className="sc-close-btn" onClick={onClose} title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeframe selector */}
        <div className="sc-tabs-row">
          {(["1d", "5d", "1mo", "1y"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`sc-tab ${period === tab ? "sc-tab-active" : ""}`}
              onClick={() => setPeriod(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Chart Window */}
        <div className="sc-chart-wrap">
          {loading ? (
            <div className="sc-loading">
              <div className="sc-spinner" />
              <span>Loading trend data…</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="sc-empty">
              <BarChart2 className="w-8 h-8 opacity-20 mr-2" />
              No historical data points available.
            </div>
          ) : (
            <>
              {/* Tooltip Overlay */}
              {activePoint && hoverIndex !== null && (
                <div
                  className="sc-tooltip"
                  style={{
                    left: `${hoverX > chartWidth / 2 + paddingLeft ? hoverX - 165 : hoverX + 25}px`,
                    top: `${Math.max(10, Math.min(height - 110, hoverY - 40))}px`,
                  }}
                >
                  <span className="sc-tooltip-date">{activePoint.date}</span>
                  <div className="sc-tooltip-row">
                    <span style={{ color: "var(--text-muted)" }}>Price:</span>
                    <span style={{ color: themeColor, fontFamily: "monospace", fontWeight: 700 }}>
                      {formatPrice(activePoint.price)}
                    </span>
                  </div>
                  <div className="sc-tooltip-row">
                    <span style={{ color: "var(--text-muted)" }}>Volume:</span>
                    <span style={{ color: "#f1f5f9", fontFamily: "monospace", fontWeight: 700 }}>
                      {formatVolume(activePoint.volume)}
                    </span>
                  </div>
                </div>
              )}

              {/* Chart SVG */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="sc-svg-container"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  {/* Glowing Trend Line Gradient */}
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="1" />
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0.8" />
                  </linearGradient>

                  {/* Gradient area under the line */}
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="0.12" />
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid guide lines + Y-axis Price Ticks */}
                {priceTicks.map((tickVal, idx) => {
                  const y = getPriceY(tickVal);
                  return (
                    <g key={`y-grid-${idx}`}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={paddingLeft + chartWidth}
                        y2={y}
                        stroke="rgba(255,255,255,0.03)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <text
                        x={paddingLeft + chartWidth + 8}
                        y={y + 3.5}
                        className="sc-grid-label"
                        textAnchor="start"
                      >
                        {tickVal.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis Date Ticks */}
                {dateTickIndices.map((idxVal) => {
                  if (idxVal < 0 || idxVal >= chartData.length) return null;
                  const pt = chartData[idxVal];
                  const x = getX(idxVal);
                  return (
                    <g key={`x-grid-${idxVal}`}>
                      <line
                        x1={x}
                        y1={paddingTop}
                        x2={x}
                        y2={paddingTop + priceChartHeight}
                        stroke="rgba(255,255,255,0.02)"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={height - 12}
                        className="sc-grid-label"
                        textAnchor="middle"
                        style={{ fill: "var(--text-secondary)" }}
                      >
                        {pt.date}
                      </text>
                    </g>
                  );
                })}

                {/* Shading area fill under Price path */}
                <path d={priceAreaD} fill="url(#areaGradient)" />

                {/* Volume vertical bars (lower zone) */}
                {chartData.map((d, idx) => {
                  const x = getX(idx);
                  const y = getVolumeY(d.volume ?? 0);
                  const barWidth = Math.max(1.5, (chartWidth / chartData.length) * 0.6);
                  
                  // Color green if price went up from previous tick, else red
                  const isUp = idx === 0 || d.price >= chartData[idx - 1].price;
                  const barColor = isUp ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)";

                  return (
                    <rect
                      key={`vol-bar-${idx}`}
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={Math.max(1, volumeTop + volumeChartHeight - y)}
                      fill={barColor}
                    />
                  );
                })}

                {/* Glowing Price Trend line */}
                <path
                  d={pricePathD}
                  fill="none"
                  stroke="url(#trendGradient)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 2px 6px ${themeColor}40)` }}
                />

                {/* Double Crosshairs & Hover overlays */}
                {hoverIndex !== null && activePoint && (
                  <>
                    {/* Vertical dashed crosshair line */}
                    <line
                      x1={hoverX}
                      y1={paddingTop}
                      x2={hoverX}
                      y2={height - 30}
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />

                    {/* Horizontal dashed price crosshair line */}
                    <line
                      x1={paddingLeft}
                      y1={hoverY}
                      x2={paddingLeft + chartWidth}
                      y2={hoverY}
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />

                    {/* Floating Axis Tags */}
                    {/* Y-Axis price coordinate tag */}
                    <rect
                      x={paddingLeft + chartWidth + 2}
                      y={hoverY - 8}
                      width={52}
                      height={16}
                      rx={3}
                      fill="rgba(18, 20, 26, 0.95)"
                      stroke={themeColor}
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft + chartWidth + 28}
                      y={hoverY + 4.5}
                      className="sc-axis-label-y"
                      textAnchor="middle"
                    >
                      {activePoint.price.toFixed(1)}
                    </text>

                    {/* X-Axis date coordinate tag */}
                    <rect
                      x={hoverX - 32}
                      y={height - 28}
                      width={64}
                      height={16}
                      rx={3}
                      fill="rgba(18, 20, 26, 0.95)"
                      stroke={themeColor}
                      strokeWidth="1"
                    />
                    <text
                      x={hoverX}
                      y={height - 15.5}
                      className="sc-axis-label-x"
                      textAnchor="middle"
                    >
                      {activePoint.date.split(" ")[0]}
                    </text>

                    {/* Glowing outer hover circle */}
                    <circle
                      cx={hoverX}
                      cy={hoverY}
                      r="7"
                      fill={themeColor}
                      fillOpacity="0.25"
                    />

                    {/* Precise inner hover circle */}
                    <circle
                      cx={hoverX}
                      cy={hoverY}
                      r="3.5"
                      fill={themeColor}
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  </>
                )}
              </svg>
            </>
          )}
        </div>

        {/* Stats Grid */}
        <div className="sc-grid-grid">
          <div className="sc-stat-card">
            <span className="sc-stat-label">Day's High</span>
            <span className="sc-stat-value">{formatPrice(details?.day_high ?? stock.day_high)}</span>
          </div>
          <div className="sc-stat-card">
            <span className="sc-stat-label">Day's Low</span>
            <span className="sc-stat-value">{formatPrice(details?.day_low ?? stock.day_low)}</span>
          </div>
          <div className="sc-stat-card">
            <span className="sc-stat-label">Volume</span>
            <span className="sc-stat-value">{formatVolume(details?.volume ?? stock.volume)}</span>
          </div>
          <div className="sc-stat-card">
            <span className="sc-stat-label">Market Cap</span>
            <span className="sc-stat-value">{formatBigNumber(details?.market_cap ?? stock.market_cap)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
