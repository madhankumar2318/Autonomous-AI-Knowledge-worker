"use client";
import { RefreshCw, Search, SearchX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

export default function NewsSection({
  infiniteScroll = false,
}: {
  infiniteScroll?: boolean;
}) {
  /** Convert ISO date → "2 hours ago" / "Yesterday" / "Apr 17" */
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
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [total, setTotal] = useState(0);

  const fetchNews = useCallback(
    async (
      pageNum: number,
      searchTopic = topic,
      searchCategory = category,
      append = false,
    ) => {
      setLoading(true);
      let url = `http://127.0.0.1:8000/news?page=${pageNum}`;
      if (searchTopic) url += `&topic=${encodeURIComponent(searchTopic)}`;
      if (searchCategory)
        url += `&category=${encodeURIComponent(searchCategory)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.news) {
          if (append) {
            setArticles((prev) => [...prev, ...data.news]);
          } else {
            setArticles(data.news);
          }
          // Use the has_more flag from backend — not a guess from article count
          setHasMore(data.has_more ?? data.news.length >= 20);
          setTotal(data.total ?? 0);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
      }
      setLoading(false);
    },
    [topic, category],
  );

  // Reset to page 1 whenever topic or category changes
  useEffect(() => {
    setPage(1);
    fetchNews(1, topic, category, false);
  }, [topic, category, fetchNews]);

  // ── Auto-refresh top-of-feed every 10 minutes ───────────────────────────
  const { countdown, isRefreshing, triggerRefresh } = useAutoRefresh({
    intervalSeconds: 600, // 10 minutes
    onRefresh: async () => {
      setPage(1);
      await fetchNews(1, topic, category, false);
      showToast("success", "News feed updated! 📰");
    },
  });

  // Load more on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!infiniteScroll || loading || !hasMore) return;
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 50;
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

  return (
    <div className="space-y-3">
      {/* ── Search Form (full width, clean) ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Search any news topic..."
            className="input input-with-icon-left"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="select sm:w-40"
        >
          <option value="">All Categories</option>
          <option value="business">Business</option>
          <option value="entertainment">Entertainment</option>
          <option value="health">Health</option>
          <option value="science">Science</option>
          <option value="sports">Sports</option>
          <option value="technology">Technology</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {/* ── Status bar: article count (left) + auto-refresh countdown (right) ── */}
      <div className="flex items-center justify-between">
        {/* Left: results info + clear filter */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {loading
              ? "Loading…"
              : total > 0
                ? `Showing ${articles.length} of ${total} articles`
                : ""}
            {(topic || category) && (
              <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>
                {topic ? ` for "${topic}"` : ""}
                {category ? ` in ${category}` : ""}
              </span>
            )}
          </span>
          {(topic || category) && (
            <button
              type="button"
              onClick={() => {
                setTopic("");
                setCategory("");
              }}
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: countdown pill */}
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={isRefreshing}
          title="Click to refresh news now"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "var(--text-muted)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: isRefreshing ? "wait" : "pointer",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-primary)";
            e.currentTarget.style.borderColor = "rgba(168,85,247,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          }}
        >
          <RefreshCw
            size={11}
            style={{
              animation: isRefreshing ? "spin 0.8s linear infinite" : "none",
            }}
          />
          {isRefreshing ? "Refreshing…" : `Refreshes in ${countdown}`}
        </button>
      </div>

      {/* Articles Grid */}
      {articles.length > 0 ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onScroll={handleScroll}
        >
          {articles.map((article, i) => (
            <article
              key={`${article.url || "news"}-${i}`}
              className="card-compact hover:shadow-md group"
            >
              {article.urlToImage && (
                <div
                  className="w-full mb-3 rounded-xl overflow-hidden"
                  style={{
                    aspectRatio: "16 / 9",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {/* biome-ignore lint/performance/noImgElement: External unspecified source */}
                  <img
                    src={article.urlToImage}
                    alt={article.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center top",
                      display: "block",
                    }}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement)
                        .parentElement!.style.display = "none";
                    }}
                  />
                </div>
              )}
              <h3 className="font-semibold text-sm text-primary line-clamp-2 mb-2">
                {article.title}
              </h3>
              <p className="text-xs text-secondary line-clamp-3 mb-3">
                {article.description}
              </p>
              {article.summary && (
                <div className="bg-surface p-3 rounded-lg mb-3">
                  <p className="text-xs text-secondary line-clamp-2">
                    <span className="font-medium text-primary">Summary:</span>{" "}
                    {article.summary}
                  </p>
                </div>
              )}
              {/* ── Source badge + date row ── */}
              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="flex items-center gap-2">
                  {/* Source badge */}
                  {article.source && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.25)",
                        color: "#818cf8",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        maxWidth: "120px",
                        textOverflow: "ellipsis",
                        display: "inline-block",
                      }}
                    >
                      {article.source}
                    </span>
                  )}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Read more →
                  </a>
                </div>
                {/* Relative date */}
                {article.publishedAt && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(article.publishedAt)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : !loading ? (
        <div
          className="flex flex-col items-center top-[10%] relative justify-center py-16 text-center animate-fade-in"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderRadius: "16px",
            border: "1px dashed rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(99,102,241,0.1))",
              border: "1px solid rgba(168,85,247,0.2)",
            }}
          >
            <SearchX
              className="w-8 h-8 text-primary"
              style={{ color: "#a855f7" }}
            />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
            No articles found
          </h3>
          <p className="text-sm text-secondary max-w-sm px-4 leading-relaxed mb-6">
            We couldn't find any news matching{" "}
            <strong className="text-primary tracking-wide">"{topic}"</strong>{" "}
            {category && `in ${category}`}.
            <br />
            Try refining your search or relaxing the filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setTopic("");
              setCategory("");
            }}
            className="btn btn-secondary shadow-md transition-all hover:scale-105"
            style={{ fontWeight: 600, letterSpacing: "0.5px" }}
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      )}

      {/* Load More Button */}
      {!infiniteScroll && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchNews(nextPage, topic, category, true);
            }}
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
