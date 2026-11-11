"use client";
import {
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  SearchX,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

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
  CNN: "#cc0000",
  Reuters: "#ff6600",
  Bloomberg: "#ff6d00",
  TechCrunch: "#0a8a07",
  "The Verge": "#e40000",
  Wired: "#000000",
  default: "var(--accent-primary, #10b981)",
};

function getSourceColor(source?: string) {
  if (!source) return SOURCE_COLORS.default;
  return SOURCE_COLORS[source] || SOURCE_COLORS.default;
}

function getSourceBadgeStyle(source?: string) {
  const color = getSourceColor(source);
  if (color.startsWith("var")) {
    return {
      background: `color-mix(in srgb, ${color} 16%, transparent)`,
      borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
      color,
    };
  }
  return {
    background: `${color}18`,
    borderColor: `${color}40`,
    color,
  };
}

function timeAgo(iso?: string): string {
  if (!iso) return "Just now";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function decodeHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(raw?: string): { title: string; sourceSuffix?: string } {
  if (!raw) return { title: "Latest Breaking News" };
  const cleaned = decodeHtml(raw);
  const m = cleaned.match(/^(.*?)\s+[-–—]\s+([^-–—]{2,40})$/);
  if (m) {
    return { title: m[1].trim(), sourceSuffix: m[2].trim() };
  }
  return { title: cleaned };
}

function cleanDescription(desc?: string, title?: string, source?: string): string {
  if (!desc) {
    return `${cleanTitle(title).title}. Live developing coverage reported by ${source || "Global News"} with continuous updates.`;
  }
  const cleaned = decodeHtml(desc);
  if (cleaned.length < 25) {
    return `${cleaned}. Live developing coverage reported by ${source || "Global News"} with continuous updates.`;
  }
  return cleaned;
}

function isRecent(iso?: string): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 1000 * 60 * 25; // breaking within 25m
}

// Curated high-resolution 16:9 news images from Unsplash CDN
const THEMATIC_IMAGES: Record<string, string[]> = {
  politics: [
    "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1575517111478-7f6afd0973db?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  court: [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1453733197781-7178555201a0?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  world: [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  military: [
    "https://images.unsplash.com/photo-1579975096649-e773152b04cb?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1508873696983-2df5293cb395?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  business: [
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  technology: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  health: [
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  science: [
    "https://images.unsplash.com/photo-1517976487507-526435f0a719?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  sports: [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&h=450&q=80",
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&h=450&q=80",
    "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&h=450&q=80",
  ],
};

function getSmartImage(title: string, category?: string, index = 0): string {
  const lower = (title || "").toLowerCase();
  let pool = THEMATIC_IMAGES.world;

  if (lower.match(/\b(court|judge|trial|jury|lawyer|lawsuit|prosecut|guilty|mistrial|testif|probe|hearing|justice|death row|commute|prison|sentence)\b/)) {
    pool = THEMATIC_IMAGES.court;
  } else if (lower.match(/\b(trump|biden|senate|congress|house|democrat|republican|president|minister|parliament|vote|election|politico|govern|midterm|governor)\b/)) {
    pool = THEMATIC_IMAGES.politics;
  } else if (lower.match(/\b(war|military|strike|drone|missile|attack|ukraine|russia|israel|gaza|iran|troops|army|weapon|terror|defense|treaty|broker)\b/)) {
    pool = THEMATIC_IMAGES.military;
  } else if (lower.match(/\b(stock|shares|market|investor|fed|rate|inflation|bank|economy|revenue|earnings|trade|tariff|bitcoin|crypto|dow|sp500|nasdaq|gold|oil)\b/)) {
    pool = THEMATIC_IMAGES.business;
  } else if (lower.match(/\b(ai|nvidia|chip|tech|software|google|apple|microsoft|openai|robot|computer|quantum|cyber|coding)\b/)) {
    pool = THEMATIC_IMAGES.technology;
  } else if (lower.match(/\b(health|doctor|hospital|cancer|virus|disease|medical|fda|drug|vaccine|patient|pandemic)\b/)) {
    pool = THEMATIC_IMAGES.health;
  } else if (lower.match(/\b(space|nasa|rocket|starship|spacex|satellite|mars|moon|astronaut|telescope|orbit|planet|astronomy)\b/)) {
    pool = THEMATIC_IMAGES.science;
  } else if (lower.match(/\b(sport|football|soccer|nfl|nba|premier league|match|cup|goal|coach|olympic|tennis|race|player)\b/)) {
    pool = THEMATIC_IMAGES.sports;
  } else if (lower.match(/\b(movie|film|actor|star|music|album|song|hollywood|oscar|grammy|concert|celebrity|theatre|culture)\b/)) {
    pool = THEMATIC_IMAGES.entertainment;
  } else if (category && THEMATIC_IMAGES[category.toLowerCase()]) {
    pool = THEMATIC_IMAGES[category.toLowerCase()];
  }

  let hash = 0;
  for (let i = 0; i < (title || "").length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const chosenIndex = Math.abs(hash + index) % pool.length;
  return pool[chosenIndex];
}

function getArticleImage(article?: Article, index = 0): string {
  if (!article) return THEMATIC_IMAGES.world[0];
  if (article.urlToImage && article.urlToImage.trim().startsWith("http")) {
    return article.urlToImage.trim();
  }
  return getSmartImage(article.title, article.source, index);
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
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());
  const [, setTick] = useState(0);

  // Live timer tick every 15 seconds to update relative timestamps on-screen in real time
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchNews = useCallback(
    async (
      pageNum: number,
      searchTopic = topic,
      searchCategory = category,
      append = false,
    ) => {
      setLoading(true);
      if (!append) setManualRefreshing(true);
      let url = `${API_BASE_URL}/news?page=${pageNum}&limit=100&_t=${Date.now()}`;
      if (searchTopic) url += `&topic=${encodeURIComponent(searchTopic)}`;
      if (searchCategory)
        url += `&category=${encodeURIComponent(searchCategory)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        const newsItems = data.news || data.articles || [];
        if (Array.isArray(newsItems) && newsItems.length > 0) {
          if (append) {
            setArticles((prev) => [...prev, ...newsItems]);
          } else {
            setArticles(newsItems);
          }
          setHasMore(data.has_more ?? data.hasMore ?? false);
          setTotal(data.total ?? data.total_results ?? newsItems.length);
          setLastRefreshedAt(Date.now());
        } else if (!append) {
          setArticles([]);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
      }
      setLoading(false);
      setManualRefreshing(false);
    },
    [topic, category],
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    try {
      const wsUrl = API_BASE_URL
        ? API_BASE_URL.replace(/^http/, "ws") + "/ws/live"
        : null;

      if (wsUrl) {
        setWsConnecting(true);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          setWsConnecting(false);
          ws?.send(JSON.stringify({ type: "subscribe", channels: ["news"] }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "news") {
              if (!topic && !category && msg.data?.news) {
                setArticles(msg.data.news);
                setTotal(msg.data.total ?? msg.data.news.length);
                setHasMore(msg.data.has_more ?? false);
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          setWsConnected(false);
          setWsConnecting(false);
        };

        ws.onerror = () => {
          setWsConnected(false);
          setWsConnecting(false);
          ws?.close();
        };
      }
    } catch {
      setWsConnecting(false);
    }

    fetchNews(1, topic, category, false);

    // Auto-refresh news every 30 seconds for live updates
    pollInterval = setInterval(() => {
      fetchNews(1, topic, category, false);
    }, 30000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
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

          <div
            className="news-refresh-wrap"
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <span
              className="stocks-live-indicator"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(52,211,153,0.08)",
                borderColor: "rgba(52,211,153,0.3)",
                color: "#34d399",
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid",
              }}
            >
              <span
                className="stocks-live-dot"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#34d399",
                  boxShadow: "0 0 8px #34d399",
                  animation: "pulse 2s infinite",
                }}
              />
              <span>Live · Real-Time Updates</span>
            </span>

            {!loading && total > 0 && (
              <span
                className="news-count"
                style={{ fontSize: "11px", color: "var(--text-secondary)" }}
              >
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
              <RefreshCw
                size={12}
                className={manualRefreshing ? "animate-spin" : ""}
              />
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="news-skeleton-card skeleton" />
            ))}
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
                className="news-hero-card premium-card-hover"
              >
                <div className="news-hero-img-wrap">
                  <img
                    src={getArticleImage(featuredArticle, 0)}
                    alt={cleanTitle(featuredArticle.title).title}
                    className="news-hero-img"
                    loading="eager"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fallback = getSmartImage(featuredArticle.title, featuredArticle.source, 1);
                      if (img.src !== fallback) {
                        img.src = fallback;
                      }
                    }}
                  />
                  <div className="news-hero-img-overlay" />
                </div>
                <div className="news-hero-body">
                  <div className="news-hero-meta">
                    {featuredArticle.source && (
                      <span
                        className="news-source-badge"
                        style={getSourceBadgeStyle(featuredArticle.source)}
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
                  <h3 className="news-hero-title">
                    {cleanTitle(featuredArticle.title).title}
                  </h3>
                  <p className="news-hero-desc">
                    {cleanDescription(
                      featuredArticle.description,
                      featuredArticle.title,
                      featuredArticle.source,
                    )}
                  </p>
                  <div className="news-hero-footer">
                    <span className="news-time">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(featuredArticle.publishedAt)}
                    </span>
                    <span className="news-read-link">
                      Read full story <ExternalLink className="w-3.5 h-3.5" />
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
                    className="news-side-card premium-card-hover"
                  >
                    <div className="news-side-content">
                      <div className="news-side-meta">
                        {art.source && (
                          <span
                            className="news-source-dot"
                            style={{ background: getSourceColor(art.source) }}
                          />
                        )}
                        <span className="news-side-source">
                          {art.source || "News"}
                        </span>
                        <span className="news-side-time">
                          {timeAgo(art.publishedAt)}
                        </span>
                      </div>
                      <h4 className="news-side-title">
                        {cleanTitle(art.title).title}
                      </h4>
                    </div>
                    <div className="news-side-thumb-wrap">
                      <img
                        src={getArticleImage(art, idx + 1)}
                        alt=""
                        className="news-side-thumb"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const fallback = getSmartImage(art.title, art.source, idx + 2);
                          if (img.src !== fallback) {
                            img.src = fallback;
                          }
                        }}
                      />
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
                  className="news-card premium-card-hover"
                >
                  <div className="news-card-img-wrap">
                    <img
                      src={getArticleImage(article, i + 5)}
                      alt={cleanTitle(article.title).title}
                      className="news-card-img"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const fallback = getSmartImage(article.title, article.source, i + 6);
                        if (img.src !== fallback) {
                          img.src = fallback;
                        }
                      }}
                    />
                  </div>
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <span
                        className="news-source-badge"
                        style={getSourceBadgeStyle(article.source)}
                      >
                        {article.source || "News"}
                      </span>
                      {isRecent(article.publishedAt) && (
                        <span className="news-new-badge">New</span>
                      )}
                    </div>
                    <h4 className="news-card-title">
                      {cleanTitle(article.title).title}
                    </h4>
                    <p className="news-card-desc">
                      {cleanDescription(
                        article.description,
                        article.title,
                        article.source,
                      )}
                    </p>
                    <div className="news-card-footer">
                      <span className="news-time">
                        <Clock className="w-3 h-3" />
                        {timeAgo(article.publishedAt)}
                      </span>
                      <span className="news-read-pill">
                        Read story <ExternalLink className="w-3 h-3 news-card-ext" />
                      </span>
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
            <SearchX className="w-6 h-6" style={{ color: "var(--accent-primary, #22d3ee)" }} />
          </div>
          <h3 className="news-empty-title">No articles found</h3>
          <p className="news-empty-sub">
            {topic ? `Nothing matching "${topic}"` : "Try a different category"}
            {category ? ` in ${category}` : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              setTopic("");
              setCategory("");
            }}
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
            onClick={() => {
              const np = page + 1;
              setPage(np);
              fetchNews(np, topic, category, true);
            }}
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
          padding: 16px 20px 32px;
        }

        /* ── TOOLBAR ── */
        .news-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          padding-top: 4px;
          padding-bottom: 12px;
        }
        .news-toolbar-top {
          display: contents;
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
          border-color: color-mix(in srgb, var(--accent-primary, #22d3ee) 40%, transparent);
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
          background: color-mix(in srgb, var(--accent-primary, #22d3ee) 18%, transparent) !important;
          border-color: color-mix(in srgb, var(--accent-primary, #22d3ee) 40%, transparent) !important;
          color: var(--accent-primary, #22d3ee) !important;
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
          border-color: color-mix(in srgb, var(--accent-primary, #22d3ee) 30%, transparent);
          box-shadow: var(--shadow-base), 0 0 0 1px color-mix(in srgb, var(--accent-primary, #22d3ee) 15%, transparent);
          transform: translateY(-2px);
        }
        .news-hero-img-wrap {
          position: relative;
          aspect-ratio: 16/9;
          width: 100%;
          overflow: hidden;
          background: #0b0f19;
        }
        .news-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }
        .news-hero-card:hover .news-hero-img { transform: scale(1.03); }
        .news-hero-img-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 45%;
          background: linear-gradient(to top, rgba(6,6,16,0.65), transparent);
          pointer-events: none;
        }
        .news-hero-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .news-hero-meta { display: flex; align-items: center; gap: 8px; }
        .news-hero-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.35;
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
          padding-top: 12px;
          border-top: 1px solid var(--border-light);
          margin-top: auto;
        }
        .news-read-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--accent-primary, #22d3ee);
          transition: all 0.15s ease;
        }
        .news-hero-card:hover .news-read-link { color: #67e8f9; transform: translateX(2px); }

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
          gap: 12px;
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
          border-color: color-mix(in srgb, var(--accent-primary, #22d3ee) 25%, transparent);
          transform: translateX(2px);
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
        .news-side-card:hover .news-side-title { color: var(--accent-primary-hover, #22d3ee); }
        .news-side-thumb-wrap {
          width: 70px;
          height: 70px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          background: #0b0f19;
        }
        .news-side-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.25s ease;
        }
        .news-side-card:hover .news-side-thumb { transform: scale(1.06); }

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
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 16px;
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
          border-color: color-mix(in srgb, var(--accent-primary, #22d3ee) 25%, transparent);
          transform: translateY(-2px);
          box-shadow: var(--shadow-base);
        }
        .news-card-img-wrap {
          position: relative;
          aspect-ratio: 16/9;
          width: 100%;
          overflow: hidden;
          background: #0b0f19;
        }
        .news-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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
        .news-card:hover .news-card-title { color: var(--accent-primary-hover, #22d3ee); }
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
          padding-top: 10px;
          border-top: 1px solid var(--border-light);
          margin-top: auto;
        }
        .news-read-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-primary, #22d3ee);
          transition: all 0.15s ease;
        }
        .news-card:hover .news-read-pill {
          color: #67e8f9;
          transform: translateX(2px);
        }
        .news-card-ext {
          transition: transform 0.15s;
        }
        .news-card:hover .news-card-ext {
          transform: translate(1px, -1px);
        }

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
          background: color-mix(in srgb, var(--accent-primary, #22d3ee) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent-primary, #22d3ee) 25%, transparent);
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
      `}</style>
    </div>
  );
}
