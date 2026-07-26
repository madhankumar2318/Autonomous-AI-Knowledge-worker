"use client";
import { AlertCircle, ExternalLink, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
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
          <p className="text-sm text-muted">Searching...</p>
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
          {/* AI Synthesis Header Banner */}
          <div
            onClick={handleSynthesizeAll}
            style={{
              padding: "12px 16px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(168,85,247,0.16) 0%, rgba(34,211,238,0.14) 100%)",
              border: "1px solid rgba(168,85,247,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 20px rgba(168,85,247,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "linear-gradient(135deg, #a855f7, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={16} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                  Generate AI Web Overview for "{query}"
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                  Synthesize key facts, timeline, and takeaways across search results
                </div>
              </div>
            </div>
            <button
              type="button"
              style={{
                background: "#a855f7",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Analyze with AI ✨
            </button>
          </div>

          {/* Search Result Cards */}
          {results.map((r, _i) => (
            <div
              key={`${r.link}-${_i}`}
              className="card-compact hover:border-accent transition-all group relative"
              style={{ position: "relative" }}
            >
              <div className="flex items-start gap-3">
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 group"
                >
                  <h3 className="font-semibold text-sm text-accent group-hover:underline line-clamp-2 mb-1">
                    {r.title}
                  </h3>
                  <p className="text-xs text-secondary line-clamp-2">
                    {r.snippet}
                  </p>
                </a>

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
