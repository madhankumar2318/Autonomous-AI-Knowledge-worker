"use client";
import { AlertCircle, Search, Sparkles, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
  fresh?: boolean;
}

type FilterTab = "all" | "news" | "web";

// ─── Helpers ────────────────────────────────────────────────
function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  const domain = extractDomain(url);
  return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
}

function cleanSnippet(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Parse the raw timestamp from the snippet and strip it so the snippet
 * shows only the clean description text.
 * Format from backend: "🕐 Thu, 24 Jul 2026 10:24:00 GMT — actual snippet"
 */
function parseTimestamp(snippet: string): { time: string; text: string } {
  // Match: optional clock emoji + date string + em-dash separator
  const match = snippet.match(
    /^🕐\s*([\w,\s:]+(?:GMT|UTC|EST|PST|IST)?)\s*—\s*([\s\S]*)$/
  );
  if (match) {
    const rawTime = match[1].trim();
    const text = cleanSnippet(match[2]);
    // Convert to relative or human-friendly date
    try {
      const date = new Date(rawTime);
      const now = Date.now();
      const diff = now - date.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      let time: string;
      if (mins < 2) time = "just now";
      else if (mins < 60) time = `${mins} min ago`;
      else if (hrs < 24) time = `${hrs} hr ago`;
      else if (days < 7) time = `${days} day${days > 1 ? "s" : ""} ago`;
      else
        time = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: days > 365 ? "numeric" : undefined,
        });
      return { time, text };
    } catch {
      return { time: rawTime, text };
    }
  }
  return { time: "", text: cleanSnippet(snippet) };
}

// ─── Component ──────────────────────────────────────────────
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
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setResults([]);
      setEngines([]);
      setPage(1);
      setError("");
      setHasSearched(true);
      setActiveFilter("all");
      fetchSearch(initialQuery, 1);
    }
  }, [initialQuery]);

  const fetchSearch = async (q: string, pageNum: number) => {
    if (!q) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/search?query=${encodeURIComponent(q)}&page=${pageNum}`
      );
      const data = await res.json();

      // Has results — use them regardless of partial engine errors
      if (data.results && data.results.length > 0) {
        setResults((prev) => [...prev, ...data.results]);
        if (data.engines) setEngines(data.engines);
        // If there was also an error (partial failure), set a soft warning
        if (data.error) {
          setError("⚠️ Some sources timed out — showing partial results.");
        }
      } else if (data.error) {
        // No results at all
        setError("Search failed. Please try again.");
      } else {
        setResults([]);
      }
    } catch {
      setError("Failed to connect to search service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) { setError("Please enter a search query"); return; }
    setResults([]);
    setEngines([]);
    setPage(1);
    setError("");
    setHasSearched(true);
    setActiveFilter("all");
    fetchSearch(query, 1);
  };

  const handleSparklesClick = (
    e: React.MouseEvent,
    resultTitle: string,
    snippet: string
  ) => {
    e.stopPropagation();
    const prompt = `Perform a comprehensive research breakdown and clean summary on:\nTopic: "${query}"\nHeadline: "${resultTitle}"\nDetails: ${snippet}\nWhat are the main key takeaways, background context, and key facts?`;
    window.dispatchEvent(new CustomEvent("ak-set-chat-prompt", { detail: { prompt } }));
    window.dispatchEvent(new CustomEvent("ak-add-notification", {
      detail: { type: "info", title: "Web Research Triggered", message: `Sent "${resultTitle.slice(0, 40)}..." to AI Assistant.` },
    }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!infiniteScroll || loading) return;
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 100;
    if (bottom) {
      setPage((p) => { const next = p + 1; fetchSearch(query, next); return next; });
    }
  };

  // Filter results by tab
  const filteredResults = results.filter((r) => {
    if (activeFilter === "news") return r.fresh === true;
    if (activeFilter === "web") return !r.fresh;
    return true;
  });

  const newsCount = results.filter((r) => r.fresh).length;
  const webCount = results.filter((r) => !r.fresh).length;

  return (
    <div className="search-root" onScroll={handleScroll}>

      {/* ── Search Form ── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search anything..."
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

      {/* ── Filter Pills (only after search) ── */}
      {hasSearched && results.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {(
            [
              { id: "all", label: "🔍 All", count: results.length },
              { id: "news", label: "📰 News", count: newsCount },
              { id: "web", label: "🌐 Web", count: webCount },
            ] as { id: FilterTab; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              style={{
                padding: "5px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: activeFilter === tab.id
                  ? "1px solid rgba(168,85,247,0.7)"
                  : "1px solid rgba(255,255,255,0.12)",
                background: activeFilter === tab.id
                  ? "rgba(168,85,247,0.2)"
                  : "rgba(255,255,255,0.05)",
                color: activeFilter === tab.id ? "#c084fc" : "rgba(255,255,255,0.6)",
                transition: "all 0.2s ease",
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ marginLeft: "5px", opacity: 0.7, fontSize: "10px" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          {/* Engine badges */}
          <span style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
            {engines.includes("google_news_rss") && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                🔴 Google News
              </span>
            )}
            {engines.includes("bing_news_rss") && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(14,165,233,0.15)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.25)" }}>
                🔵 Bing News
              </span>
            )}
            {engines.includes("duckduckgo_web") && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>
                🌐 Web
              </span>
            )}
            {engines.includes("wikipedia") && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)" }}>
                📖 Wikipedia
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Error: full failure — no results ── */}
      {error && results.length === 0 && (
        <div className="alert alert-error flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* ── Warning: partial failure — results still showing ── */}
      {error && results.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "7px 12px", borderRadius: "8px",
          background: "rgba(251,191,36,0.08)",
          border: "1px solid rgba(251,191,36,0.2)",
          fontSize: "11px", color: "rgba(251,191,36,0.85)",
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          One search source timed out — showing available results.
        </div>
      )}

      {/* ── Loading ── */}
      {loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="spinner mb-3" />
          <p className="text-sm text-muted">Searching across Google News &amp; Web...</p>
        </div>
      )}

      {/* ── Idle Hint ── */}
      {!hasSearched && !loading && !error && (
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          Type a query above and press <strong>Search</strong>
        </p>
      )}

      {/* ── Empty State ── */}
      {!loading && filteredResults.length === 0 && !error && hasSearched && (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center mb-2">
            <Search className="w-4 h-4 text-muted" />
          </div>
          <p className="text-sm text-secondary">No results for &quot;{query}&quot;</p>
          <p className="text-xs text-muted mt-1">Try different keywords or switch filter tabs</p>
        </div>
      )}

      {/* ── Results ── */}
      {filteredResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {filteredResults.map((r, _i) => {
            const domain = extractDomain(r.link);
            const favicon = faviconUrl(r.link);
            const { time, text } = parseTimestamp(r.snippet);

            return (
              <div
                key={`${r.link}-${_i}`}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  transition: "all 0.18s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(168,85,247,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                {/* Row 1: Favicon + Domain + LIVE badge */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <img
                    src={favicon}
                    alt=""
                    width={16}
                    height={16}
                    style={{ borderRadius: "3px", flexShrink: 0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
                    {domain}
                  </span>
                  {r.fresh && (
                    <span style={{
                      fontSize: "9px", fontWeight: 800, padding: "1px 6px",
                      borderRadius: "5px", background: "rgba(239,68,68,0.2)",
                      color: "#f87171", border: "1px solid rgba(239,68,68,0.35)",
                      letterSpacing: "0.5px",
                    }}>
                      🔴 LIVE
                    </span>
                  )}
                  {time && (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>
                      {time}
                    </span>
                  )}
                </div>

                {/* Row 2: Clickable Title */}
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", marginBottom: "6px", textDecoration: "none" }}
                >
                  <h3 style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#818cf8",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    margin: 0,
                    transition: "color 0.15s ease",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#818cf8"; }}
                  >
                    {r.title}
                  </h3>
                </a>

                {/* Row 3: Snippet */}
                {text && (
                  <p style={{
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.55)",
                    lineHeight: 1.6,
                    margin: "0 0 10px 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {text}
                  </p>
                )}

                {/* Row 4: Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={(e) => handleSparklesClick(e, r.title, text || r.snippet)}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "5px 12px", borderRadius: "8px", fontSize: "11px",
                      fontWeight: 700, cursor: "pointer",
                      background: "rgba(168,85,247,0.12)",
                      border: "1px solid rgba(168,85,247,0.28)",
                      color: "#c084fc", transition: "all 0.18s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#a855f7";
                      e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(168,85,247,0.12)";
                      e.currentTarget.style.color = "#c084fc";
                    }}
                  >
                    <Sparkles size={11} />
                    AI Summary
                  </button>

                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px",
                      fontWeight: 600, color: "rgba(255,255,255,0.4)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      textDecoration: "none", transition: "all 0.18s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                  >
                    <ExternalLink size={11} />
                    Open
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .search-root {
          display: flex;
          flex-direction: column;
          gap: 14px;
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
