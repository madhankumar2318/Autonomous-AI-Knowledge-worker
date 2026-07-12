"use client";
import { Clock, ExternalLink, Newspaper, RefreshCw, Search, SearchX, Zap } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { showToast } from "./Toast";

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage?: string;
  publishedAt?: string;
  summary?: string;
  source?: string;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "business", label: "Business" },
  { value: "technology", label: "Technology" },
  { value: "science", label: "Science" },
  { value: "health", label: "Health" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
];

const SOURCE_COLORS: Record<string, string> = {
  "BBC News": "#ee3d24",
  "CNN": "#cc0000",
  "Reuters": "#ff6600",
  "Bloomberg": "#ff6d00",
  "TechCrunch": "#0a8a07",
  "The Verge": "#e40000",
  "Wired": "#000000",
  default: "#22d3ee",
};

function getSourceColor(source?: string) {
  if (!source) return SOURCE_COLORS.default;
  return SOURCE_COLORS[source] || SOURCE_COLORS.default;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isRecent(iso?: string): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 3600000 * 3; // within 3h
}

// Generate a unique gradient for articles without images based on title hash
const GRADIENT_PALETTES = [
  ["#0891b2", "#06b6d4", "#22d3ee"],   // cyan
  ["#0d9488", "#14b8a6", "#2dd4bf"],   // teal
  ["#0284c7", "#0ea5e9", "#38bdf8"],   // sky
  ["#2563eb", "#3b82f6", "#60a5fa"],   // blue
  ["#7c3aed", "#8b5cf6", "#a78bfa"],   // violet
  ["#db2777", "#ec4899", "#f472b6"],   // pink
  ["#dc2626", "#ef4444", "#f87171"],   // red
  ["#ea580c", "#f97316", "#fb923c"],   // orange
  ["#d97706", "#f59e0b", "#fbbf24"],   // amber
  ["#059669", "#10b981", "#34d399"],   // emerald
  ["#4f46e5", "#6366f1", "#818cf8"],   // indigo
  ["#9333ea", "#a855f7", "#c084fc"],   // purple
];

function getPlaceholderGradient(title?: string): string {
  if (!title) return `linear-gradient(135deg, ${GRADIENT_PALETTES[0][0]}33, ${GRADIENT_PALETTES[0][2]}22)`;
  // Simple hash from title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % GRADIENT_PALETTES.length;
  const p = GRADIENT_PALETTES[idx];
  return `linear-gradient(135deg, ${p[0]}35, ${p[1]}20, ${p[2]}10)`;
}

export default function NewsSection({
  infiniteScroll = false,
}: {
  infiniteScroll?: boolean;
  layout?: "split" | "list";
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const fetchNews = useCallback(
    async (pageNum: number, searchTopic = topic, searchCategory = category, append = false) => {
      setLoading(true);
      if (!append) setManualRefreshing(true);
      let url = `${API_BASE_URL}/news?page=${pageNum}`;
      if (searchTopic) url += `&topic=${encodeURIComponent(searchTopic)}`;
      if (searchCategory) url += `&category=${encodeURIComponent(searchCategory)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.news) {
          if (append) {
            setArticles((prev) => [...prev, ...data.news]);
          } else {
            setArticles(data.news);
          }
          setHasMore(data.has_more ?? data.news.length >= 100);
          setTotal(data.total ?? 0);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
      }
      setLoading(false);
      setManualRefreshing(false);
    },
    [topic, category]
  );

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws/live";
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      setWsConnecting(true);
      console.log("[WS] Connecting to news stream...");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected to news stream.");
        setWsConnected(true);
        setWsConnecting(false);
        ws?.send(JSON.stringify({ type: "subscribe", channels: ["news"] }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "news") {
            // Only update live feed if there is no active topic/category filter
            if (!topic && !category) {
              setArticles(msg.data.news);
              setTotal(msg.data.total);
              setHasMore(msg.data.has_more);
            }
          }
        } catch (e) {
          console.error("[WS] Error parsing news message:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WS] News stream disconnected. Retrying in 5 seconds...");
        setWsConnected(false);
        setWsConnecting(true);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("[WS] News stream error:", err);
        ws?.close();
      };
    }

    connect();
    fetchNews(1, topic, category, false);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [topic, category, fetchNews]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!infiniteScroll || loading || !hasMore) return;
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 80;
    if (bottom) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNews(nextPage, topic, category, true);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchNews(1, topic, category, false);
  };

  const featuredArticle = articles[0];
  const sideArticles = articles.slice(1, 5);
  const remainingArticles = articles.slice(5);

  return (
    <div className="news-root" onScroll={handleScroll}>
      {/* ── TOOLBAR ── */}
      <div className="news-toolbar">
        <div className="news-toolbar-top">
          <form onSubmit={handleSearch} className="news-search-form">
            <Search className="news-search-icon" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Search topics, keywords…"
              className="news-search-input"
              id="news-search"
            />
          </form>

          <div className="news-refresh-wrap" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="stocks-live-indicator" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: wsConnected ? "rgba(52,211,153,0.08)" : (wsConnecting ? "rgba(251,191,36,0.08)" : "rgba(248,113,113,0.08)"),
              borderColor: wsConnected ? "rgba(52,211,153,0.3)" : (wsConnecting ? "rgba(251,191,36,0.3)" : "rgba(248,113,113,0.3)"),
              color: wsConnected ? "#34d399" : (wsConnecting ? "#fbbf24" : "#f87171"),
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              border: "1px solid"
            }}>
              <span className="stocks-live-dot" style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: wsConnected ? "#34d399" : (wsConnecting ? "#fbbf24" : "#f87171"),
                boxShadow: wsConnected ? "0 0 8px #34d399" : (wsConnecting ? "0 0 8px #fbbf24" : "none"),
                animation: wsConnected ? "pulse 2s infinite" : "none"
              }} />
              {wsConnected ? "Real-Time Live" : (wsConnecting ? "Connecting Live..." : "Disconnected")}
            </span>

            {!loading && total > 0 && (
              <span className="news-count" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                {articles.length} / {total}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchNews(1, topic, category, false)}
              disabled={manualRefreshing}
              className="news-refresh-btn"
              title="Refresh news"
            >
              <RefreshCw size={12} className={manualRefreshing ? "animate-spin" : ""} />
              <span>{manualRefreshing ? "Syncing…" : "Sync Now"}</span>
            </button>
          </div>
        </div>

        <div className="news-category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`news-cat-pill ${category === cat.value ? "news-cat-active" : ""}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SKELETON ── */}
      {loading && articles.length === 0 && (
        <div className="news-skeleton-grid">
          <div className="news-skeleton-hero skeleton" />
          <div className="news-skeleton-side">
            {[...Array(4)].map((_, i) => <div key={i} className="news-skeleton-card skeleton" />)}
          </div>
        </div>
      )}

      {/* ── ARTICLES ── */}
      {articles.length > 0 && (
        <div className="news-content">

          {/* ── HERO + SIDEBAR ── */}
          {featuredArticle && (
            <div className="news-hero-row">
              {/* Featured Hero */}
              <a
                href={featuredArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-hero-card"
              >
                {featuredArticle.urlToImage ? (
                  <div className="news-hero-img-wrap">
                    <img
                      src={featuredArticle.urlToImage}
                      alt={featuredArticle.title}
                      className="news-hero-img"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const parent = img.parentElement!;
                        parent.classList.add('news-img-fallback');
                        parent.style.background = getPlaceholderGradient(featuredArticle.title);
                        img.style.display = 'none';
                        // Insert icon if not already there
                        if (!parent.querySelector('.news-placeholder-icon')) {
                          const icon = document.createElement('div');
                          icon.className = 'news-placeholder-icon';
                          icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>';
                          parent.appendChild(icon);
                        }
                      }}
                    />
                    <div className="news-hero-img-overlay" />
                  </div>
                ) : (
                  <div className="news-hero-img-placeholder" style={{ background: getPlaceholderGradient(featuredArticle.title) }}>
                    <Newspaper className="w-12 h-12" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  </div>
                )}
                <div className="news-hero-body">
                  <div className="news-hero-meta">
                    {featuredArticle.source && (
                      <span
                        className="news-source-badge"
                        style={{ background: `${getSourceColor(featuredArticle.source)}22`, borderColor: `${getSourceColor(featuredArticle.source)}55`, color: getSourceColor(featuredArticle.source) }}
                      >
                        {featuredArticle.source}
                      </span>
                    )}
                    {isRecent(featuredArticle.publishedAt) && (
                      <span className="news-breaking-badge">
                        <Zap className="w-2.5 h-2.5" /> Breaking
                      </span>
                    )}
                  </div>
                  <h3 className="news-hero-title">{featuredArticle.title}</h3>
                  <p className="news-hero-desc">{featuredArticle.description}</p>
                  <div className="news-hero-footer">
                    <span className="news-time">
                      <Clock className="w-3 h-3" />
                      {timeAgo(featuredArticle.publishedAt)}
                    </span>
                    <span className="news-read-link">
                      Read full story <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </a>

              {/* Side Stories */}
              <div className="news-side-col">
                <div className="news-side-label">Latest Stories</div>
                {sideArticles.map((art, idx) => (
                  <a
                    key={idx}
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-side-card"
                  >
                    <div className="news-side-content">
                      <div className="news-side-meta">
                        {art.source && (
                          <span
                            className="news-source-dot"
                            style={{ background: getSourceColor(art.source) }}
                          />
                        )}
                        <span className="news-side-source">{art.source || "News"}</span>
                        <span className="news-side-time">{timeAgo(art.publishedAt)}</span>
                      </div>
                      <h4 className="news-side-title">{art.title}</h4>
                    </div>
                    <div className="news-side-thumb-wrap" style={!art.urlToImage ? { background: getPlaceholderGradient(art.title), display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                    {art.urlToImage ? (
                      <img
                        src={art.urlToImage}
                        alt=""
                        className="news-side-thumb"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const parent = img.parentElement!;
                          parent.style.background = getPlaceholderGradient(art.title);
                          parent.style.display = 'flex';
                          parent.style.alignItems = 'center';
                          parent.style.justifyContent = 'center';
                          img.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Newspaper className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── MORE ARTICLES GRID ── */}
          {remainingArticles.length > 0 && (
            <div className="news-grid">
              {remainingArticles.map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
                >
                  <div className="news-card-img-wrap" style={!article.urlToImage ? { background: getPlaceholderGradient(article.title), display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}>
                    {article.urlToImage ? (
                      <img
                        src={article.urlToImage}
                        alt={article.title}
                        className="news-card-img"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const parent = img.parentElement!;
                          parent.style.background = getPlaceholderGradient(article.title);
                          parent.style.display = 'flex';
                          parent.style.alignItems = 'center';
                          parent.style.justifyContent = 'center';
                          img.style.display = 'none';
                          if (!parent.querySelector('.news-placeholder-icon')) {
                            const icon = document.createElement('div');
                            icon.className = 'news-placeholder-icon';
                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>';
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    ) : (
                      <Newspaper className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.15)' }} />
                    )}
                  </div>
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <span
                        className="news-source-badge"
                        style={{ background: `${getSourceColor(article.source)}18`, borderColor: `${getSourceColor(article.source)}40`, color: getSourceColor(article.source) }}
                      >
                        {article.source || "News"}
                      </span>
                      {isRecent(article.publishedAt) && (
                        <span className="news-new-badge">New</span>
                      )}
                    </div>
                    <h4 className="news-card-title">{article.title}</h4>
                    <p className="news-card-desc">{article.description}</p>
                    <div className="news-card-footer">
                      <span className="news-time">
                        <Clock className="w-3 h-3" />
                        {timeAgo(article.publishedAt)}
                      </span>
                      <ExternalLink className="w-3 h-3 news-card-ext" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {articles.length === 0 && !loading && (
        <div className="news-empty">
          <div className="news-empty-icon">
            <SearchX className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="news-empty-title">No articles found</h3>
          <p className="news-empty-sub">
            {topic ? `Nothing matching "${topic}"` : "Try a different category"}
            {category ? ` in ${category}` : ""}
          </p>
          <button
            type="button"
            onClick={() => { setTopic(""); setCategory(""); }}
            className="btn btn-secondary text-xs"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── LOADING MORE ── */}
      {loading && articles.length > 0 && (
        <div className="news-loading-more">
          <div className="spinner" />
          <span>Loading more…</span>
        </div>
      )}

      {/* ── LOAD MORE BTN ── */}
      {!infiniteScroll && hasMore && !loading && articles.length > 0 && (
        <div className="news-load-more-wrap">
          <button
            type="button"
            onClick={() => { const np = page + 1; setPage(np); fetchNews(np, topic, category, true); }}
            className="btn btn-secondary"
          >
            Load More Headlines
          </button>
        </div>
      )}

      <style>{`
        .news-root {
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

        /* ── TOOLBAR ── */
        .news-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--bg-primary);
          padding-top: 4px;
          padding-bottom: 12px;
        }
        .news-toolbar-top {
          display: contents; /* Flat list on desktop */
        }
        .news-search-form {
          position: relative;
          flex: 0 0 240px;
          order: 1;
        }
        .news-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 13px;
          height: 13px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .news-search-input {
          width: 100%;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          padding: 8px 12px 8px 32px;
          font-size: 14px;
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s ease;
        }
        .news-search-input:focus {
          background: var(--bg-hover);
          border-color: rgba(34,211,238,0.4);
        }
        .news-search-input::placeholder { color: var(--text-muted); }

        .news-category-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
          order: 2;
        }
        .news-cat-pill {
          padding: 5px 12px;
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
        .news-cat-pill:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-medium);
        }
        .news-cat-active {
          background: rgba(34,211,238,0.15) !important;
          border-color: rgba(34,211,238,0.4) !important;
          color: #67e8f9 !important;
        }

        .news-refresh-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          margin-left: auto;
          order: 3;
        }
        .news-count {
          font-size: 13px;
          color: var(--text-muted);
        }
        .news-refresh-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          font-variant-numeric: tabular-nums;
        }
        .news-refresh-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .news-refresh-btn:disabled { opacity: 0.5; cursor: wait; }

        /* ── SKELETON ── */
        .news-skeleton-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
        }
        .news-skeleton-hero { height: 380px; border-radius: 16px; }
        .news-skeleton-side {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .news-skeleton-card { height: 85px; border-radius: 12px; }

        /* ── CONTENT ── */
        .news-content { display: flex; flex-direction: column; gap: 20px; }

        /* ── HERO ROW ── */
        .news-hero-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .news-hero-row { grid-template-columns: 1fr; }
        }

        /* Hero Card */
        .news-hero-card {
          display: flex;
          flex-direction: column;
          border-radius: 20px;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          text-decoration: none;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .news-hero-card:hover {
          border-color: rgba(34,211,238,0.3);
          box-shadow: var(--shadow-base), 0 0 0 1px rgba(34,211,238,0.15);
          transform: translateY(-2px);
        }
        .news-hero-img-wrap {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
          background: var(--bg-secondary);
        }
        .news-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .news-hero-card:hover .news-hero-img { transform: scale(1.03); }
        .news-hero-img-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(to top, rgba(6,6,16,0.6), transparent);
        }
        .news-hero-img-placeholder {
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid var(--border-light);
        }
        .news-img-fallback {
          display: flex !important;
          align-items: center;
          justify-content: center;
        }
        .news-placeholder-icon {
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .news-hero-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .news-hero-meta { display: flex; align-items: center; gap: 8px; }
        .news-hero-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
          letter-spacing: -0.3px;
          transition: color 0.15s ease;
        }
        .news-hero-card:hover .news-hero-title { color: #67e8f9; }
        .news-hero-desc {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .news-hero-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border-light);
          margin-top: auto;
        }
        .news-read-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 600;
          color: #22d3ee;
          transition: color 0.15s;
        }
        .news-hero-card:hover .news-read-link { color: #22d3ee; }

        /* Side column */
        .news-side-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .news-side-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0 4px 4px;
          border-bottom: 1px solid var(--border-light);
        }
        .news-side-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border-radius: 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .news-side-card:hover {
          background: var(--bg-hover);
          border-color: rgba(34,211,238,0.25);
        }
        .news-side-content { flex: 1; min-width: 0; }
        .news-side-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .news-source-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .news-side-source {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .news-side-time {
          font-size: 11px;
          color: var(--text-muted);
          margin-left: auto;
          white-space: nowrap;
        }
        .news-side-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s;
        }
        .news-side-card:hover .news-side-title { color: var(--accent-primary-hover); }
        .news-side-thumb-wrap {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--bg-secondary);
        }
        .news-side-thumb { width: 100%; height: 100%; object-fit: cover; }

        /* ── BADGES ── */
        .news-source-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 5px;
          border: 1px solid;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .news-breaking-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 5px;
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.3);
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .news-new-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 5px;
          background: rgba(16,185,129,0.15);
          color: #34d399;
          border: 1px solid rgba(16,185,129,0.3);
          letter-spacing: 0.5px;
        }
        .news-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        /* ── NEWS GRID ── */
        .news-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .news-card {
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .news-card:hover {
          background: var(--bg-hover);
          border-color: rgba(34,211,238,0.2);
          transform: translateY(-2px);
          box-shadow: var(--shadow-base);
        }
        .news-card-img-wrap {
          aspect-ratio: 16/9;
          overflow: hidden;
          background: var(--bg-secondary);
        }
        .news-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.35s ease;
        }
        .news-card:hover .news-card-img { transform: scale(1.04); }
        .news-card-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          flex: 1;
        }
        .news-card-meta { display: flex; align-items: center; gap: 6px; }
        .news-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s;
        }
        .news-card:hover .news-card-title { color: var(--accent-primary-hover); }
        .news-card-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .news-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid var(--border-light);
          margin-top: auto;
        }
        .news-card-ext {
          color: var(--text-muted);
          transition: color 0.15s;
        }
        .news-card:hover .news-card-ext { color: #22d3ee; }

        /* ── EMPTY STATE ── */
        .news-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px;
          gap: 12px;
          text-align: center;
          background: var(--bg-secondary);
          border: 1px dashed var(--border-light);
          border-radius: 20px;
        }
        .news-empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(34,211,238,0.08);
          border: 1px solid rgba(34,211,238,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .news-empty-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .news-empty-sub { font-size: 14px; color: var(--text-secondary); }

        /* ── LOADING MORE ── */
        .news-loading-more {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 20px;
          font-size: 14px;
          color: rgba(255,255,255,0.3);
        }
        .news-load-more-wrap {
          display: flex;
          justify-content: center;
          padding: 16px 0;
        }

        @media (max-width: 640px) {
          .news-root {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          .news-toolbar {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 8px 4px !important;
          }
          .news-toolbar-top {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 10px !important;
            order: 1 !important;
          }
          .news-search-form {
            width: 100% !important;
            flex: unset !important;
          }
          .news-refresh-wrap {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            margin-left: 0 !important;
            flex-shrink: unset !important;
          }
          .news-category-pills {
            order: 2 !important;
            width: 100% !important;
            flex: unset !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            padding-bottom: 4px !important;
          }
          .news-category-pills::-webkit-scrollbar {
            display: none !important;
          }
          .news-cat-pill {
            flex-shrink: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
