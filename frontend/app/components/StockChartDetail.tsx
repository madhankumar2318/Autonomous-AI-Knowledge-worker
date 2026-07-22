"use client";
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Sparkles,
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
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
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

// ── Technical Indicator Calculations ─────────────────────────────────────
function calcSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcRSI(prices: number[], period = 14): (number | null)[] {
  if (prices.length < period + 1) return prices.map(() => null);
  const rsi: (number | null)[] = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const getRS = (g: number, l: number) => (l === 0 ? 100 : g / l);
  rsi.push(100 - 100 / (1 + getRS(avgGain, avgLoss)));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(100 - 100 / (1 + getRS(avgGain, avgLoss)));
  }
  return rsi;
}

export default function StockChartDetail({ stock, onClose }: StockChartDetailProps) {
  const [period, setPeriod] = useState<"1d" | "5d" | "1mo" | "1y">("1mo");
  const [chartData, setChartData] = useState<HistoricalPoint[]>([]);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Indicator toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showRSI, setShowRSI] = useState(false);

  const isPos = (stock.change_percent ?? 0) >= 0;
  const themeColor = isPos ? "#34d399" : "#f87171";
  const themeRgb = isPos ? "52,211,153" : "248,113,113";

  useEffect(() => {
    setLoading(true);
    setHoverIndex(null);
    fetch(`${API_BASE_URL}/stock/history/${stock.symbol}?period=${period}`)
      .then((r) => { if (!r.ok) throw new Error("History fetch failed"); return r.json(); })
      .then((d) => { setChartData(d.data || []); if (d.details) setDetails(d.details); })
      .catch(() => showToast("error", "Failed to load historical trend chart."))
      .finally(() => setLoading(false));
  }, [stock.symbol, period]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // ── SVG Dimensions ──────────────────────────────────────────────────────
  const width = 640;
  const paddingLeft = 20;
  const paddingRight = 65;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;

  const priceChartHeight = showRSI ? 120 : 155;
  const volumeChartHeight = 38;
  const rsiChartHeight = 68;
  const volumeTop = paddingTop + priceChartHeight + 12;
  const rsiTop = volumeTop + volumeChartHeight + 18;
  const totalHeight = showRSI
    ? rsiTop + rsiChartHeight + paddingBottom
    : paddingTop + priceChartHeight + volumeChartHeight + 12 + paddingBottom;

  const prices = chartData.map((d) => d.price);
  const minVal = prices.length ? Math.min(...prices) : 0;
  const maxVal = prices.length ? Math.max(...prices) : 1;
  const valRange = maxVal - minVal || 1;
  const volumes = chartData.map((d) => d.volume ?? 0);
  const maxVolume = Math.max(...volumes) || 1;

  const getX = (index: number) => {
    if (chartData.length <= 1) return paddingLeft;
    return paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  };
  const getPriceY = (p: number) =>
    paddingTop + priceChartHeight - ((p - minVal) / valRange) * priceChartHeight;
  const getVolumeY = (v: number) =>
    volumeTop + volumeChartHeight - (v / maxVolume) * volumeChartHeight;
  const getRsiY = (r: number) =>
    rsiTop + rsiChartHeight - (r / 100) * rsiChartHeight;

  // ── Indicator data ──────────────────────────────────────────────────────
  const sma20 = calcSMA(prices, 20);
  const sma50 = calcSMA(prices, 50);
  const rsiValues = calcRSI(prices, 14);

  const buildPath = (values: (number | null)[], getY: (v: number) => number) => {
    let d = "";
    values.forEach((v, i) => {
      if (v === null) return;
      const x = getX(i); const y = getY(v);
      d += d === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return d;
  };

  const sma20Path = buildPath(sma20, getPriceY);
  const sma50Path = buildPath(sma50, getPriceY);
  const rsiPath = buildPath(rsiValues, getRsiY);

  const pricePoints = chartData.map((pt, i) => ({ x: getX(i), y: getPriceY(pt.price) }));
  const pricePathD = pricePoints.length > 0
    ? `M ${pricePoints[0].x} ${pricePoints[0].y} ` + pricePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";
  const priceAreaD = pricePoints.length > 0
    ? `${pricePathD} L ${pricePoints[pricePoints.length - 1].x} ${paddingTop + priceChartHeight} L ${pricePoints[0].x} ${paddingTop + priceChartHeight} Z`
    : "";

  const priceTicks = [maxVal, minVal + valRange * 0.66, minVal + valRange * 0.33, minVal];
  const dateTickIndices = chartData.length > 1
    ? [0, Math.floor((chartData.length - 1) * 0.33), Math.floor((chartData.length - 1) * 0.66), chartData.length - 1]
    : [0];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartData.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, (x - (paddingLeft / rect.width) * rect.width) / ((chartWidth / rect.width) * rect.width)));
    setHoverIndex(Math.max(0, Math.min(chartData.length - 1, Math.round(pct * (chartData.length - 1)))));
  };

  const activePoint = hoverIndex !== null ? chartData[hoverIndex] : null;
  const hoverX = hoverIndex !== null && pricePoints[hoverIndex] ? pricePoints[hoverIndex].x : 0;
  const hoverY = hoverIndex !== null && pricePoints[hoverIndex] ? pricePoints[hoverIndex].y : 0;
  const hoverSMA20 = hoverIndex !== null ? sma20[hoverIndex] : null;
  const hoverSMA50 = hoverIndex !== null ? sma50[hoverIndex] : null;
  const hoverRSI = hoverIndex !== null ? rsiValues[hoverIndex] : null;

  const lastRSI = rsiValues[rsiValues.length - 1] ?? null;
  const displayRSI = hoverRSI ?? lastRSI;
  const getRSISignal = (r: number | null) => {
    if (r === null) return { label: "—", color: "#94a3b8" };
    if (r >= 70) return { label: "Overbought", color: "#f87171" };
    if (r <= 30) return { label: "Oversold", color: "#34d399" };
    return { label: "Neutral", color: "#fbbf24" };
  };
  const rsiSignal = getRSISignal(displayRSI);

  return (
    <div className="sc-overlay">
      <style>{`
        .sc-overlay {
          position: fixed; inset: 0; z-index: 1100;
          display: flex; align-items: center; justify-content: center;
          background: rgba(10, 11, 16, 0.87);
          backdrop-filter: blur(14px);
          animation: scFadeIn 0.2s ease-out; padding: 20px;
        }
        @keyframes scFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sc-container {
          width: 100%; max-width: 700px;
          background: var(--bg-sidebar, #12141a);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px; overflow: hidden;
          box-shadow: 0 28px 72px rgba(0,0,0,0.65), 0 0 60px rgba(${themeRgb}, 0.06);
          animation: scScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex; flex-direction: column;
          max-height: 94vh; overflow-y: auto;
        }
        @keyframes scScaleIn { from { transform: scale(0.94) translateY(12px); } to { transform: scale(1) translateY(0); } }
        .sc-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05);
          background: linear-gradient(to right, rgba(${themeRgb}, 0.04), transparent);
        }
        .sc-title-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sc-symbol-row { display: flex; align-items: center; gap: 10px; }
        .sc-symbol { font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
        .sc-name { font-size: 13px; color: #64748b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
        .sc-price-row { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
        .sc-price { font-size: 30px; font-weight: 800; color: #fff; font-family: monospace; letter-spacing: -1px; }
        .sc-change-badge {
          display: flex; align-items: center; gap: 4px;
          font-size: 13px; font-weight: 700; padding: 3px 10px;
          border-radius: 8px; border: 1px solid;
        }
        .sc-close-btn {
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          color: #64748b; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
        }
        .sc-close-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .sc-controls-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.04);
          gap: 8px; flex-wrap: wrap; background: rgba(0,0,0,0.08);
        }
        .sc-tabs-group { display: flex; gap: 4px; }
        .sc-tab {
          font-size: 11px; font-weight: 700; color: #64748b;
          background: transparent; border: 1px solid transparent;
          padding: 4px 11px; border-radius: 7px; cursor: pointer; transition: all 0.15s;
        }
        .sc-tab:hover { color: #cbd5e1; background: rgba(255,255,255,0.04); }
        .sc-tab-active {
          color: ${themeColor} !important;
          background: rgba(${themeRgb}, 0.1) !important;
          border-color: rgba(${themeRgb}, 0.25) !important;
        }
        .sc-indicator-group { display: flex; gap: 5px; align-items: center; }
        .sc-indicator-label { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.6px; margin-right: 2px; }
        .sc-ind-pill {
          font-size: 10px; font-weight: 700;
          padding: 3px 10px; border-radius: 20px;
          border: 1px solid; cursor: pointer; transition: all 0.2s ease;
          letter-spacing: 0.3px;
        }
        .sc-ind-pill:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .sc-chart-wrap {
          padding: 12px 20px 14px 20px;
          background: rgba(0,0,0,0.22); position: relative;
        }
        .sc-svg-container { width: 100%; overflow: visible; cursor: crosshair; display: block; }
        .sc-tooltip {
          position: absolute; z-index: 10;
          background: rgba(10, 12, 18, 0.97);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 13px; padding: 10px 14px;
          pointer-events: none;
          box-shadow: 0 16px 40px rgba(0,0,0,0.65);
          display: flex; flex-direction: column; gap: 5px;
          font-size: 11px; font-weight: 500; min-width: 160px;
        }
        .sc-tooltip-date {
          color: #64748b; font-size: 10px; font-weight: 600;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 5px; margin-bottom: 2px;
        }
        .sc-tooltip-row { display: flex; justify-content: space-between; gap: 14px; }
        .sc-grid-label { font-size: 10px; font-family: monospace; fill: #475569; font-weight: 500; }
        .sc-axis-label-y { font-size: 10px; font-weight: 700; fill: #ffffff; }
        .sc-axis-label-x { font-size: 10px; font-weight: 700; fill: #ffffff; }
        .sc-section-label { font-size: 9px; font-weight: 700; fill: #334155; letter-spacing: 1px; text-transform: uppercase; }
        .sc-grid-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          padding: 16px 24px; gap: 14px; background: var(--bg-secondary, #0c0e12);
        }
        .sc-stat-card { display: flex; flex-direction: column; gap: 4px; }
        .sc-stat-label { font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        .sc-stat-value { font-size: 14px; font-weight: 700; color: #f1f5f9; font-family: monospace; }
        .sc-rsi-stat { grid-column: span 2; display: flex; flex-direction: column; gap: 5px; }
        .sc-rsi-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 8px;
          font-size: 11px; font-weight: 700; width: fit-content;
        }
        .sc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #475569; height: 240px; }
        .sc-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.06); border-top-color: ${themeColor}; border-radius: 50%; animation: scSpin 0.8s linear infinite; }
        @keyframes scSpin { to { transform: rotate(360deg); } }
        .sc-empty { display: flex; align-items: center; justify-content: center; height: 240px; color: #475569; font-size: 12px; gap: 8px; }
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
              <div className="sc-change-badge" style={{
                background: isPos ? "rgba(52,211,153,0.09)" : "rgba(248,113,113,0.09)",
                borderColor: isPos ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)",
                color: themeColor,
              }}>
                {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatChange(stock.change_percent)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                const isPos = (stock.change_percent ?? 0) >= 0;
                const prompt = `Perform a comprehensive technical and fundamental checkup on ${stock.symbol} (${stock.name || stock.symbol}):\n\n- Current Price: ${formatPrice(stock.price)}\n- 24h Change: ${isPos ? "+" : ""}${formatChange(stock.change_percent)}\n- Trading Volume: ${formatVolume(stock.volume)}\n\nWhat is the market sentiment, key support/resistance levels, and overall outlook?`;
                window.dispatchEvent(new CustomEvent("ak-set-chat-prompt", { detail: { prompt } }));
                window.dispatchEvent(new CustomEvent("ak-add-notification", {
                  detail: { title: "Stock Checkup Triggered", message: `Sent ${stock.symbol} metrics to AI Analyst.`, type: "info" }
                }));
                onClose();
              }}
              title="Analyze this stock with AI"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "10px",
                background: "rgba(34, 211, 238, 0.12)",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                color: "#22d3ee",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Sparkles size={14} />
              <span>AI Checkup</span>
            </button>
            <button className="sc-close-btn" onClick={onClose} title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Timeframe + Indicators */}
        <div className="sc-controls-row">
          <div className="sc-tabs-group">
            {(["1d", "5d", "1mo", "1y"] as const).map((tab) => (
              <button key={tab} type="button"
                className={`sc-tab ${period === tab ? "sc-tab-active" : ""}`}
                onClick={() => setPeriod(tab)}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="sc-indicator-group">
            <span className="sc-indicator-label">Indicators</span>
            <button type="button" className="sc-ind-pill"
              onClick={() => setShowSMA20(p => !p)}
              style={{
                background: showSMA20 ? "rgba(251,191,36,0.12)" : "transparent",
                borderColor: showSMA20 ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)",
                color: showSMA20 ? "#fbbf24" : "#475569",
              }}>SMA 20</button>
            <button type="button" className="sc-ind-pill"
              onClick={() => setShowSMA50(p => !p)}
              style={{
                background: showSMA50 ? "rgba(147,197,253,0.12)" : "transparent",
                borderColor: showSMA50 ? "rgba(147,197,253,0.4)" : "rgba(255,255,255,0.08)",
                color: showSMA50 ? "#93c5fd" : "#475569",
              }}>SMA 50</button>
            <button type="button" className="sc-ind-pill"
              onClick={() => setShowRSI(p => !p)}
              style={{
                background: showRSI ? "rgba(196,181,253,0.12)" : "transparent",
                borderColor: showRSI ? "rgba(196,181,253,0.4)" : "rgba(255,255,255,0.08)",
                color: showRSI ? "#c4b5fd" : "#475569",
              }}>RSI 14</button>
          </div>
        </div>

        {/* Chart Window */}
        <div className="sc-chart-wrap">
          {loading ? (
            <div className="sc-loading">
              <div className="sc-spinner" />
              <span style={{ fontSize: 12 }}>Loading trend data…</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="sc-empty">
              <BarChart2 size={28} style={{ opacity: 0.2 }} />
              No historical data points available.
            </div>
          ) : (
            <>
              {/* Tooltip */}
              {activePoint && hoverIndex !== null && (
                <div className="sc-tooltip" style={{
                  left: `${hoverX > chartWidth / 2 + paddingLeft ? hoverX - 178 : hoverX + 16}px`,
                  top: `${Math.max(8, Math.min(priceChartHeight - 90, hoverY - 32))}px`,
                }}>
                  <span className="sc-tooltip-date">{activePoint.date}</span>
                  <div className="sc-tooltip-row">
                    <span style={{ color: "#64748b" }}>Price</span>
                    <span style={{ color: themeColor, fontFamily: "monospace", fontWeight: 700 }}>{formatPrice(activePoint.price)}</span>
                  </div>
                  <div className="sc-tooltip-row">
                    <span style={{ color: "#64748b" }}>Volume</span>
                    <span style={{ color: "#f1f5f9", fontFamily: "monospace", fontWeight: 700 }}>{formatVolume(activePoint.volume)}</span>
                  </div>
                  {showSMA20 && hoverSMA20 !== null && (
                    <div className="sc-tooltip-row">
                      <span style={{ color: "#64748b" }}>SMA 20</span>
                      <span style={{ color: "#fbbf24", fontFamily: "monospace", fontWeight: 700 }}>{formatPrice(hoverSMA20)}</span>
                    </div>
                  )}
                  {showSMA50 && hoverSMA50 !== null && (
                    <div className="sc-tooltip-row">
                      <span style={{ color: "#64748b" }}>SMA 50</span>
                      <span style={{ color: "#93c5fd", fontFamily: "monospace", fontWeight: 700 }}>{formatPrice(hoverSMA50)}</span>
                    </div>
                  )}
                  {showRSI && hoverRSI !== null && (
                    <div className="sc-tooltip-row">
                      <span style={{ color: "#64748b" }}>RSI 14</span>
                      <span style={{ color: "#c4b5fd", fontFamily: "monospace", fontWeight: 700 }}>{hoverRSI.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* SVG Canvas */}
              <svg ref={svgRef}
                viewBox={`0 0 ${width} ${totalHeight}`}
                className="sc-svg-container"
                style={{ height: totalHeight }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="1" />
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={themeColor} stopOpacity="0.13" />
                    <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Price Grid */}
                {priceTicks.map((tickVal, idx) => {
                  const y = getPriceY(tickVal);
                  return (
                    <g key={`y-grid-${idx}`}>
                      <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y}
                        stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="2 3" />
                      <text x={paddingLeft + chartWidth + 8} y={y + 3.5}
                        className="sc-grid-label" textAnchor="start">{tickVal.toFixed(2)}</text>
                    </g>
                  );
                })}

                {/* X-axis dates */}
                {dateTickIndices.map((idxVal) => {
                  if (idxVal < 0 || idxVal >= chartData.length) return null;
                  const pt = chartData[idxVal];
                  const x = getX(idxVal);
                  return (
                    <g key={`x-grid-${idxVal}`}>
                      <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + priceChartHeight}
                        stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                      <text x={x} y={totalHeight - paddingBottom + 14}
                        className="sc-grid-label" textAnchor="middle" style={{ fill: "#475569" }}>
                        {pt.date}
                      </text>
                    </g>
                  );
                })}

                {/* Area fill */}
                <path d={priceAreaD} fill="url(#areaGradient)" />

                {/* SMA 20 */}
                {showSMA20 && sma20Path && (
                  <path d={sma20Path} fill="none" stroke="#fbbf24" strokeWidth="1.6"
                    strokeLinecap="round" strokeDasharray="5 2"
                    style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.55))" }} />
                )}
                {/* SMA 50 */}
                {showSMA50 && sma50Path && (
                  <path d={sma50Path} fill="none" stroke="#93c5fd" strokeWidth="1.6"
                    strokeLinecap="round" strokeDasharray="7 3"
                    style={{ filter: "drop-shadow(0 0 5px rgba(147,197,253,0.55))" }} />
                )}

                {/* Volume Bars */}
                <text x={paddingLeft} y={volumeTop - 4} className="sc-section-label">VOLUME</text>
                {chartData.map((d, idx) => {
                  const x = getX(idx);
                  const y = getVolumeY(d.volume ?? 0);
                  const bw = Math.max(1.5, (chartWidth / chartData.length) * 0.58);
                  const isUp = idx === 0 || d.price >= chartData[idx - 1].price;
                  return (
                    <rect key={`vol-${idx}`}
                      x={x - bw / 2} y={y} width={bw}
                      height={Math.max(1, volumeTop + volumeChartHeight - y)}
                      fill={isUp ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
                  );
                })}

                {/* Price Line */}
                <path d={pricePathD} fill="none" stroke="url(#trendGradient)"
                  strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 2px 7px ${themeColor}50)` }} />

                {/* RSI Panel */}
                {showRSI && (
                  <>
                    <line x1={paddingLeft} y1={rsiTop - 9} x2={paddingLeft + chartWidth} y2={rsiTop - 9}
                      stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <text x={paddingLeft} y={rsiTop - 11} className="sc-section-label">RSI (14)</text>

                    {/* Zone fills */}
                    <rect x={paddingLeft} y={rsiTop} width={chartWidth}
                      height={Math.max(0, getRsiY(70) - rsiTop)}
                      fill="rgba(248,113,113,0.04)" />
                    <rect x={paddingLeft} y={getRsiY(30)} width={chartWidth}
                      height={Math.max(0, rsiTop + rsiChartHeight - getRsiY(30))}
                      fill="rgba(52,211,153,0.04)" />

                    {/* Level lines */}
                    <line x1={paddingLeft} y1={getRsiY(70)} x2={paddingLeft + chartWidth} y2={getRsiY(70)}
                      stroke="rgba(248,113,113,0.35)" strokeWidth="0.8" strokeDasharray="3 3" />
                    <text x={paddingLeft + chartWidth + 6} y={getRsiY(70) + 3.5}
                      className="sc-grid-label" style={{ fill: "#f87171" }}>70</text>

                    <line x1={paddingLeft} y1={getRsiY(50)} x2={paddingLeft + chartWidth} y2={getRsiY(50)}
                      stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeDasharray="2 5" />
                    <text x={paddingLeft + chartWidth + 6} y={getRsiY(50) + 3.5}
                      className="sc-grid-label">50</text>

                    <line x1={paddingLeft} y1={getRsiY(30)} x2={paddingLeft + chartWidth} y2={getRsiY(30)}
                      stroke="rgba(52,211,153,0.35)" strokeWidth="0.8" strokeDasharray="3 3" />
                    <text x={paddingLeft + chartWidth + 6} y={getRsiY(30) + 3.5}
                      className="sc-grid-label" style={{ fill: "#34d399" }}>30</text>

                    {/* RSI line */}
                    {rsiPath && (
                      <path d={rsiPath} fill="none" stroke="#c4b5fd" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ filter: "drop-shadow(0 1px 6px rgba(196,181,253,0.55))" }} />
                    )}

                    {/* RSI hover dot */}
                    {hoverIndex !== null && hoverRSI !== null && (
                      <>
                        <circle cx={hoverX} cy={getRsiY(hoverRSI)} r="4"
                          fill="#c4b5fd" stroke="#fff" strokeWidth="1"
                          style={{ filter: "drop-shadow(0 0 6px rgba(196,181,253,0.7))" }} />
                        <line x1={hoverX} y1={rsiTop} x2={hoverX} y2={rsiTop + rsiChartHeight}
                          stroke="rgba(255,255,255,0.09)" strokeWidth="1" strokeDasharray="3 3" />
                      </>
                    )}
                  </>
                )}

                {/* Crosshairs */}
                {hoverIndex !== null && activePoint && (
                  <>
                    <line x1={hoverX} y1={paddingTop} x2={hoverX}
                      y2={showRSI ? rsiTop + rsiChartHeight : volumeTop + volumeChartHeight}
                      stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1={paddingLeft} y1={hoverY} x2={paddingLeft + chartWidth} y2={hoverY}
                      stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3" />
                    <rect x={paddingLeft + chartWidth + 2} y={hoverY - 8} width={58} height={16}
                      rx={3} fill="rgba(10,12,18,0.97)" stroke={themeColor} strokeWidth="1" />
                    <text x={paddingLeft + chartWidth + 31} y={hoverY + 4.5}
                      className="sc-axis-label-y" textAnchor="middle">{activePoint.price.toFixed(1)}</text>
                    <rect x={hoverX - 34} y={totalHeight - paddingBottom + 2} width={68} height={16}
                      rx={3} fill="rgba(10,12,18,0.97)" stroke={themeColor} strokeWidth="1" />
                    <text x={hoverX} y={totalHeight - paddingBottom + 14}
                      className="sc-axis-label-x" textAnchor="middle">{activePoint.date.split(" ")[0]}</text>
                    <circle cx={hoverX} cy={hoverY} r="7" fill={themeColor} fillOpacity="0.2" />
                    <circle cx={hoverX} cy={hoverY} r="3.5" fill={themeColor} stroke="#fff" strokeWidth="1.2"
                      style={{ filter: `drop-shadow(0 0 7px ${themeColor})` }} />
                  </>
                )}
              </svg>
            </>
          )}
        </div>

        {/* Stats Grid */}
        <div className="sc-grid-grid">
          <div className="sc-stat-card">
            <span className="sc-stat-label">Day High</span>
            <span className="sc-stat-value">{formatPrice(details?.day_high ?? stock.day_high)}</span>
          </div>
          <div className="sc-stat-card">
            <span className="sc-stat-label">Day Low</span>
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
          {showRSI && (
            <div className="sc-rsi-stat">
              <span className="sc-stat-label">RSI Signal</span>
              <span className="sc-rsi-badge" style={{
                background: `${rsiSignal.color}18`,
                border: `1px solid ${rsiSignal.color}40`,
                color: rsiSignal.color,
              }}>
                <Activity size={10} />
                RSI {(displayRSI ?? 0).toFixed(1)} — {rsiSignal.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
