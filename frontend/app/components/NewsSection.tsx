"use client";
import { Calendar, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage?: string;
  publishedAt?: string;
  summary?: string;
}

export default function NewsSection({
  infiniteScroll = false,
}: {
  infiniteScroll?: boolean;
}) {
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
      if (searchTopic)    url += `&topic=${encodeURIComponent(searchTopic)}`;
      if (searchCategory) url += `&category=${encodeURIComponent(searchCategory)}`;
      try {
        const res  = await fetch(url);
        const data = await res.json();
        if (data.news) {
          if (append) {
            setArticles(prev => [...prev, ...data.news]);
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

  useEffect(() => {
    setPage(1);
    fetchNews(1, topic, category, false);
  }, [topic, category, fetchNews]);

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
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
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
          className="select sm:w-48"
        >
          <option value="">All Categories</option>
          <option value="business">Business</option>
          <option value="entertainment">Entertainment</option>
          <option value="health">Health</option>
          <option value="science">Science</option>
          <option value="sports">Sports</option>
          <option value="technology">Technology</option>
        </select>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {/* Results count badge */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {loading ? "Loading…" : `Showing ${articles.length} of ${total} articles`}
            {(topic || category) && (
              <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>
                {topic ? ` for "${topic}"` : ""}{category ? ` in ${category}` : ""}
              </span>
            )}
          </span>
          {(topic || category) && (
            <button
              type="button"
              onClick={() => { setTopic(""); setCategory(""); }}
              style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Articles Grid */}
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
                style={{ aspectRatio: "16 / 9", background: "rgba(255,255,255,0.04)" }}
              >
                {/* biome-ignore lint/performance/noImgElement: External unspecified source */}
                <img
                  src={article.urlToImage}
                  alt={article.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                  loading="lazy"
                  decoding="async"
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
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
            <div className="flex items-center justify-between">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-accent hover:underline"
              >
                Read more →
              </a>
              {article.publishedAt && (
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Calendar className="w-3 h-3" />
                  {new Date(article.publishedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

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
