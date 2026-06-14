"use client";
import { RefreshCw, Search, SearchX } from "lucide-react";
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

export default function NewsSection({
  infiniteScroll = false,
  layout = "split",
}: {
  infiniteScroll?: boolean;
  layout?: "split" | "list";
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

  useEffect(() => {
    setPage(1);
    fetchNews(1, topic, category, false);
  }, [topic, category, fetchNews]);

  const { countdown, isRefreshing, triggerRefresh } = useAutoRefresh({
    intervalSeconds: 600, // 10 minutes
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

  // Google News Split Layout preparation
  const featuredArticle = articles[0];
  const sideArticles = articles.slice(1, 4);
  const remainingArticles = articles.slice(4);

  return (
    <div className="space-y-4 pr-1" onScroll={handleScroll}>
      {/* Search and Filters Header */}
      <form
        onSubmit={handleSearch}
        className="flex gap-2 flex-wrap sm:flex-nowrap"
      >
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Search news topic..."
            className="input input-with-icon-left w-full"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="select sm:w-40 w-full"
        >
          <option value="">All Categories</option>
          <option value="business">Business</option>
          <option value="entertainment">Entertainment</option>
          <option value="health">Health</option>
          <option value="science">Science</option>
          <option value="sports">Sports</option>
          <option value="technology">Technology</option>
        </select>
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          Search
        </button>
      </form>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <div>
          {!loading && total > 0 && (
            <span>
              Showing {articles.length} of {total} headlines
              {(topic || category) && (
                <span className="text-purple-400 font-semibold ml-1">
                  {topic ? `for "${topic}"` : ""}{" "}
                  {category ? `in ${category}` : ""}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
          <span>
            {isRefreshing ? "Refreshing..." : `Auto-refresh in ${countdown}`}
          </span>
        </button>
      </div>

      {articles.length > 0 ? (
        <div className="space-y-6">
          {/* ── GOOGLE NEWS STYLE SPLIT (Only on page 1) ── */}
          {page === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Featured Large Card (Left 2/3) */}
              {featuredArticle && (
                <div className="lg:col-span-2 flex flex-col bg-white/4 border border-white/5 rounded-2xl p-5 hover:bg-white/8 hover:border-purple-500/20 transition-all duration-200">
                  {featuredArticle.urlToImage && (
                    <div className="w-full mb-4 rounded-xl overflow-hidden aspect-video bg-white/4">
                      <img
                        src={featuredArticle.urlToImage}
                        alt={featuredArticle.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement)
                            .parentElement!.style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {featuredArticle.source && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 mb-2">
                      {featuredArticle.source}
                    </span>
                  )}

                  <h2 className="text-lg font-bold text-white mb-2 leading-snug hover:text-purple-300 transition-colors">
                    <a
                      href={featuredArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {featuredArticle.title}
                    </a>
                  </h2>

                  <p className="text-sm text-white/60 line-clamp-3 mb-4 leading-relaxed">
                    {featuredArticle.description}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 text-xs text-white/40">
                    <a
                      href={featuredArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 font-semibold hover:underline"
                    >
                      Read full article →
                    </a>
                    {featuredArticle.publishedAt && (
                      <span>{timeAgo(featuredArticle.publishedAt)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Side Related Stories (Right 1/3) */}
              <div className="lg:col-span-1 flex flex-col gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Related Stories
                </div>
                {sideArticles.map((art, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col bg-white/4 border border-white/5 rounded-xl p-4 hover:bg-white/8 hover:border-purple-500/20 transition-all cursor-pointer"
                    onClick={() => window.open(art.url, "_blank")}
                  >
                    <span className="text-[9px] uppercase font-bold tracking-wider text-purple-400 mb-1.5">
                      {art.source || "News Feed"}
                    </span>
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug mb-2">
                      {art.title}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-white/40 mt-auto pt-1">
                      <span className="text-purple-400/80 font-medium">
                        Read Article
                      </span>
                      {art.publishedAt && (
                        <span>{timeAgo(art.publishedAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remaining stories in a structured grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(page === 1 ? remainingArticles : articles).map((article, i) => (
              <article
                key={i}
                className="flex flex-col bg-white/4 border border-white/5 rounded-xl p-4 hover:bg-white/8 hover:border-purple-500/20 transition-all group"
              >
                {article.urlToImage && (
                  <div className="w-full mb-3 rounded-lg overflow-hidden aspect-video bg-white/4">
                    <img
                      src={article.urlToImage}
                      alt={article.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement)
                          .parentElement!.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <span className="text-[9px] uppercase font-bold tracking-wider text-purple-400 mb-1.5">
                  {article.source || "News"}
                </span>
                <h3 className="font-bold text-xs text-white line-clamp-2 mb-2 leading-snug">
                  {article.title}
                </h3>
                <p className="text-[11px] text-white/60 line-clamp-3 mb-3 leading-normal">
                  {article.description}
                </p>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 text-[10px] text-white/40">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 font-semibold hover:underline"
                  >
                    Read more →
                  </a>
                  {article.publishedAt && (
                    <span>{timeAgo(article.publishedAt)}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white/2 border border-dashed border-white/10 rounded-2xl">
          <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/25 mb-4">
            <SearchX className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            No articles found
          </h3>
          <p className="text-xs text-white/40 max-w-sm mb-6">
            We couldn't find any news matching "{topic}"{" "}
            {category && `in ${category}`}.
          </p>
          <button
            type="button"
            onClick={() => {
              setTopic("");
              setCategory("");
            }}
            className="btn btn-secondary text-xs"
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      )}

      {/* Load More pagination button */}
      {!infiniteScroll && hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchNews(nextPage, topic, category, true);
            }}
            className="btn btn-secondary text-xs"
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More Headlines"}
          </button>
        </div>
      )}
    </div>
  );
}
