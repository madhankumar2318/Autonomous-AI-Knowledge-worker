"use client";
import { AlertCircle, ExternalLink, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
  fresh?: boolean;
}

export default function SearchSection({
  infiniteScroll = false,
  initialQuery = "",
}: {
  infiniteScroll?: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [_page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Trigger search if initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setResults([]);
      setPage(1);
      setError("");
      setHasSearched(true);
      fetchSearch(initialQuery, 1);
    }
  }, [initialQuery]);

  const fetchSearch = async (q: string, pageNum: number) => {
    if (!q) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/search?query=${encodeURIComponent(q)}&page=${pageNum}`,
      );
      const data = await res.json();

      // Check for API errors
      if (data.error) {
        setError(data.message || "Search failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.results) {
        setResults((prev) => [...prev, ...data.results]);
        if (data.engines) setEngines(data.engines);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Error fetching search results:", err);
      setError(
        "Failed to connect to search service. Please check if the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }
    setResults([]);
    setEngines([]);
    setPage(1);
    setError("");
    setHasSearched(true);
    fetchSearch(query, 1);
  };

  const handleSparklesClick = (e: React.MouseEvent, resultTitle: string, snippet: string) => {
    e.stopPropagation();
    const prompt = `Perform a comprehensive research breakdown and clean summary on:\nTopic: "${query}"\nHeadline: "${resultTitle}"\nDetails: ${snippet}\nWhat are the main key takeaways, background context, and key facts?`;

    window.dispatchEvent(new CustomEvent("ak-set-chat-prompt", {
      detail: { prompt }
    }));

    window.dispatchEvent(new CustomEvent("ak-add-notification", {
      detail: {
        type: "info",
        title: "Web Research Triggered",
        message: `Sent "${resultTitle.slice(0, 40)}..." to AI Assistant.`,
      }
    }));
  };

  const handleSynthesizeAll = () => {
    const topSnippets = results.slice(0, 4).map(r => `• ${r.title}: ${r.snippet}`).join("\n");
    const prompt = `Perform an in-depth clean AI research summary and breakdown for query: "${query}" based on live web search results:\n\n${topSnippets}\n\nPlease summarize the key findings, timeline/facts, and strategic takeaways in a clean structured format.`;

    window.dispatchEvent(new CustomEvent("ak-set-chat-prompt", {
      detail: { prompt }
    }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!infiniteScroll || loading) return;
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 100;
    if (bottom) {
      setPage((p) => {
        const next = p + 1;
        fetchSearch(query, next);
        return next;
      });
    }
  };

  return (
    <div className="search-root" onScroll={handleScroll}>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search Google..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="input input-with-icon-left"
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? <div className="spinner" /> : "Search"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="spinner mb-3" />
          <p className="text-sm text-muted">Searching across Google News & Web...</p>
        </div>
      )}

      {/* Idle hint — only when no search has been made yet */}
      {!hasSearched && !loading && !error && (
        <p
          className="text-xs text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Type a query above and press <strong>Search</strong>
        </p>
      )}

      {/* Empty State — only show after a search */}
      {!loading && results.length === 0 && !error && hasSearched && (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center mb-2">
            <Search className="w-4 h-4 text-muted" />
          </div>
          <p className="text-sm text-secondary">No results for "{query}"</p>
          <p className="text-xs text-muted mt-1">Try different keywords</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3 pr-1">


          {/* Engine Status Bar */}
          {engines.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Sources:</span>
              {engines.includes("google_news_rss") && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  🔴 Google News Live
                </span>
              )}
              {engines.includes("duckduckgo") && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "rgba(251,146,60,0.18)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
                  🌐 DuckDuckGo Web
                </span>
              )}
              {engines.includes("serpapi") && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "rgba(34,211,238,0.18)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
                  🔵 Google Search
                </span>
              )}
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>
                {results.length} results found
              </span>
            </div>
          )}

          {/* Search Result Cards */}
          {results.map((r, _i) => (
            <div
              key={`${r.link}-${_i}`}
              className="card-compact hover:border-accent transition-all group relative"
              style={{ position: "relative" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  {/* Title row with LIVE badge + clickable link */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                    {r.fresh && (
                      <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "5px", background: "rgba(239,68,68,0.22)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", letterSpacing: "0.5px", flexShrink: 0 }}>
                        🔴 LIVE
                      </span>
                    )}
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1 }}
                    >
                      <h3 className="font-semibold text-sm text-accent group-hover:underline line-clamp-2">
                        {r.title}
                      </h3>
                    </a>
                  </div>
                  <p className="text-xs text-secondary line-clamp-3" style={{ lineHeight: "1.6" }}>
                    {r.snippet
                      .replace(/&nbsp;/g, " ")
                      .replace(/&amp;/g, "&")
                      .replace(/&lt;/g, "<")
                      .replace(/&gt;/g, ">")
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/<[^>]+>/g, "")
                      .trim()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleSparklesClick(e, r.title, r.snippet)}
                    title="Analyze this result with AI"
                    style={{
                      background: "rgba(168, 85, 247, 0.12)",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      color: "#c084fc",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#a855f7";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(168, 85, 247, 0.12)";
                      e.currentTarget.style.color = "#c084fc";
                    }}
                  >
                    <Sparkles size={12} />
                    AI Summary
                  </button>

                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .search-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
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
      `}</style>
    </div>
  );
}
