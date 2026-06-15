"use client";
import { Clock, ExternalLink, RefreshCw, Search, SearchX, Zap } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
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

  const fetchNews = useCallback(
    async (pageNum: number, searchTopic = topic, searchCategory = category, append = false) => {
      setLoading(true);
      let url = `http://127.0.0.1:8000/news?page=${pageNum}`;
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
          setHasMore(data.has_more ?? data.news.length >= 20);
          setTotal(data.total ?? 0);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
      }
      setLoading(false);
    },
    [topic, category]
  );

  useEffect(() => {
    setPage(1);
    fetchNews(1, topic, category, false);
  }, [topic, category, fetchNews]);

  const { countdown, isRefreshing, triggerRefresh } = useAutoRefresh({
    intervalSeconds: 600,
    onRefresh: async () => {
      setPage(1);
      await fetchNews(1, topic, category, false);
      showToast("success", "News feed updated! 📰");
    },
  });

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

        <div className="news-refresh-wrap">
          {!loading && total > 0 && (
            <span className="news-count">
              {articles.length} / {total}
            </span>
          )}
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={isRefreshing}
            className="news-refresh-btn"
            title="Refresh news"
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            <span>{isRefreshing ? "Refreshing…" : countdown}</span>
          </button>
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
          {page === 1 && (
            <div className="news-hero-row">
              {/* Featured Hero */}
              {featuredArticle && (
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
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                      <div className="news-hero-img-overlay" />
                    </div>
                  ) : (
                    <div className="news-hero-img-placeholder" />
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
              )}

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
                    {art.urlToImage && (
                      <div className="news-side-thumb-wrap">
                        <img
                          src={art.urlToImage}
                          alt=""
                          className="news-side-thumb"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                        />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── MORE ARTICLES GRID ── */}
          {(page === 1 ? remainingArticles : articles).length > 0 && (
            <div className="news-grid">
              {(page === 1 ? remainingArticles : articles).map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
                >
                  {article.urlToImage && (
                    <div className="news-card-img-wrap">
                      <img
                        src={article.urlToImage}
                        alt={article.title}
                        className="news-card-img"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                      />
                    </div>
                  )}
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
          height: 100%;
          overflow-y: auto;
        }

        /* ── TOOLBAR ── */
        .news-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .news-search-form {
          position: relative;
          flex: 0 0 240px;
        }
        .news-search-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 13px;
          height: 13px;
          color: rgba(255,255,255,0.25);
          pointer-events: none;
        }
        .news-search-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 8px 12px 8px 32px;
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: all 0.2s ease;
        }
        .news-search-input:focus {
          background: rgba(255,255,255,0.07);
          border-color: rgba(34,211,238,0.4);
        }
        .news-search-input::placeholder { color: rgba(255,255,255,0.22); }

        .news-category-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
        }
        .news-cat-pill {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .news-cat-pill:hover {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.8);
          border-color: rgba(255,255,255,0.15);
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
        }
        .news-count {
          font-size: 13px;
          color: rgba(255,255,255,0.28);
        }
        .news-refresh-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.15s ease;
          font-variant-numeric: tabular-nums;
        }
        .news-refresh-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
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
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          text-decoration: none;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .news-hero-card:hover {
          border-color: rgba(34,211,238,0.3);
          box-shadow: 0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,211,238,0.15);
          transform: translateY(-2px);
        }
        .news-hero-img-wrap {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
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
          background: linear-gradient(to top, rgba(6,6,16,0.9), transparent);
        }
        .news-hero-img-placeholder {
          aspect-ratio: 16/9;
          background: linear-gradient(135deg, rgba(34,211,238,0.08), rgba(8,145,178,0.05));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .news-hero-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .news-hero-meta { display: flex; align-items: center; gap: 8px; }
        .news-hero-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          letter-spacing: -0.3px;
          transition: color 0.15s ease;
        }
        .news-hero-card:hover .news-hero-title { color: #67e8f9; }
        .news-hero-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.5);
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
          border-top: 1px solid rgba(255,255,255,0.05);
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
          color: rgba(255,255,255,0.2);
          padding: 0 4px 4px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .news-side-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .news-side-card:hover {
          background: rgba(255,255,255,0.05);
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
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .news-side-time {
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          margin-left: auto;
          white-space: nowrap;
        }
        .news-side-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s;
        }
        .news-side-card:hover .news-side-title { color: #fff; }
        .news-side-thumb-wrap {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          background: rgba(255,255,255,0.04);
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
          color: rgba(255,255,255,0.3);
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
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .news-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(34,211,238,0.2);
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.3);
        }
        .news-card-img-wrap {
          aspect-ratio: 16/9;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
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
          color: rgba(255,255,255,0.9);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s;
        }
        .news-card:hover .news-card-title { color: #fff; }
        .news-card-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
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
          border-top: 1px solid rgba(255,255,255,0.04);
          margin-top: auto;
        }
        .news-card-ext {
          color: rgba(255,255,255,0.2);
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
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.08);
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
        .news-empty-title { font-size: 17px; font-weight: 700; color: #fff; }
        .news-empty-sub { font-size: 14px; color: rgba(255,255,255,0.35); }

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
      `}</style>
    </div>
  );
}
