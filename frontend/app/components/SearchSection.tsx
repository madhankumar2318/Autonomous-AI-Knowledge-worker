"use client";
import { AlertCircle, Search, Sparkles, ExternalLink, TrendingUp, Clock, X, ArrowUpRight, Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "../config";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
  fresh?: boolean;
  is_video?: boolean;
  thumbnail?: string;
  video_id?: string;
  channel?: string;
  views?: string;
}

type FilterTab = "all" | "news" | "web" | "videos";

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

function parseTimestamp(snippet: string): { time: string; text: string } {
  const match = snippet.match(
    /^🕐\s*([\w,\s:]+(?:GMT|UTC|EST|PST|IST)?)\s*—\s*([\s\S]*)$/
  );
  if (match) {
    const rawTime = match[1].trim();
    const text = cleanSnippet(match[2]);
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

  // ── Suggestions & Trending State ──
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([
    "Apple (AAPL) Stock Performance",
    "Nvidia AI Microchips & Earnings",
    "Federal Reserve Interest Rate Outlook",
    "Global Market Trends",
    "Quantum Computing Breakthroughs",
    "Tesla EV Market Share",
  ]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ak_recent_searches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load recent searches:", e);
    }
  }, []);

  // Save to recent searches
  const saveRecentSearch = (term: string) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 6);
      try {
        localStorage.setItem("ak_recent_searches", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem("ak_recent_searches");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced fetch for suggestions
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/search/suggestions?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions) setSuggestions(data.suggestions);
          if (data.trending && data.trending.length > 0) setTrending(data.trending);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query]);

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
    saveRecentSearch(q);
    setShowDropdown(false);
    try {
      const res = await fetch(
        `${API_BASE_URL}/search?query=${encodeURIComponent(q)}&page=${pageNum}`
      );
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        setResults((prev) => [...prev, ...data.results]);
        if (data.engines) setEngines(data.engines);
        if (data.error) {
          setError("⚠️ Some sources timed out — showing partial results.");
        }
      } else if (data.error) {
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

  const executeSearch = (targetQuery: string) => {
    const clean = targetQuery.trim();
    if (!clean) return;
    setQuery(clean);
    setResults([]);
    setEngines([]);
    setPage(1);
    setError("");
    setHasSearched(true);
    setActiveFilter("all");
    fetchSearch(clean, 1);
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  // Build combined list of current suggestions for keyboard navigation
  const isQueryEmpty = !query.trim();
  const allListItems: { text: string; type: "suggestion" | "trending" | "recent" }[] = [];

  if (isQueryEmpty) {
    recentSearches.forEach((s) => allListItems.push({ text: s, type: "recent" }));
    trending.forEach((s) => allListItems.push({ text: s, type: "trending" }));
  } else {
    suggestions.forEach((s) => allListItems.push({ text: s, type: "suggestion" }));
    trending.forEach((s) => allListItems.push({ text: s, type: "trending" }));
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || allListItems.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allListItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allListItems.length) % allListItems.length);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allListItems.length) {
        executeSearch(allListItems[selectedIndex].text);
      } else {
        handleSearch();
      }
    }
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

  const filteredResults = results.filter((r) => {
    if (activeFilter === "news") return r.fresh === true && !r.is_video;
    if (activeFilter === "web") return !r.fresh && !r.is_video;
    if (activeFilter === "videos") return r.is_video === true;
    return true;
  });

  const newsCount = results.filter((r) => r.fresh && !r.is_video).length;
  const webCount = results.filter((r) => !r.fresh && !r.is_video).length;
  const videoCount = results.filter((r) => r.is_video === true).length;

  return (
    <div className="search-root" onScroll={handleScroll}>

      {/* ── Search Form with Google/Chrome Suggestions Dropdown ── */}
      <div ref={searchContainerRef} className="relative w-full z-30">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search anything (e.g., AAPL stock, AI tools, Market trends)..."
              value={query}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(-1);
                setShowDropdown(true);
              }}
              onKeyDown={handleKeyDown}
              className="input input-with-icon-left pr-9"
              disabled={loading}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(-1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? <div className="spinner" /> : "Search"}
          </button>
        </form>

        {/* ── Suggestions Dropdown Card ── */}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "#11141d",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.95)",
              overflowY: "auto",
              maxHeight: "230px",
              WebkitOverflowScrolling: "touch",
              zIndex: 9999,
              padding: "8px 0",
              animation: "scFadeIn 0.15s ease-out",
            }}
          >
            {/* Loading Indicator */}
            {loadingSuggestions && (
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "12px" }}>
                <div className="spinner" style={{ width: "14px", height: "14px" }} />
                <span>Searching suggestions...</span>
              </div>
            )}

            {/* 1. Real-time Autocomplete Suggestions */}
            {!isQueryEmpty && !loadingSuggestions && suggestions.length > 0 && (
              <div style={{ padding: "4px 0" }}>
                <div style={{
                  padding: "6px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <Search size={11} style={{ color: "#a855f7" }} />
                  Suggestions
                </div>
                {suggestions.map((item, idx) => {
                  const globalIdx = idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  return (
                    <div
                      key={`sug-${idx}`}
                      onClick={() => executeSearch(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: isHighlighted ? "#ffffff" : "#cbd5e1",
                        background: isHighlighted ? "rgba(168, 85, 247, 0.2)" : "transparent",
                        borderLeft: isHighlighted ? "3px solid #c084fc" : "3px solid transparent",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Search size={13} style={{ color: isHighlighted ? "#c084fc" : "#64748b" }} />
                        <span>{item}</span>
                      </div>
                      <ArrowUpRight size={12} style={{ color: "#475569", opacity: isHighlighted ? 1 : 0.4 }} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Default search prompt if suggestions empty */}
            {!isQueryEmpty && !loadingSuggestions && suggestions.length === 0 && (
              <div
                onClick={() => executeSearch(query)}
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#c084fc",
                  background: "rgba(168, 85, 247, 0.08)",
                }}
              >
                <Search size={14} />
                <span>Search for &quot;{query}&quot;</span>
              </div>
            )}

            {/* 2. Recent Searches (when query empty or focused) */}
            {isQueryEmpty && recentSearches.length > 0 && (
              <div style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{
                  padding: "6px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={11} style={{ color: "#38bdf8" }} />
                    Recent Searches
                  </div>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#475569",
                      fontSize: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px"
                    }}
                    title="Clear search history"
                  >
                    <Trash2 size={10} /> Clear
                  </button>
                </div>
                {recentSearches.map((item, idx) => {
                  const globalIdx = idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  return (
                    <div
                      key={`rec-${idx}`}
                      onClick={() => executeSearch(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: isHighlighted ? "#ffffff" : "#cbd5e1",
                        background: isHighlighted ? "rgba(56, 189, 248, 0.2)" : "transparent",
                        borderLeft: isHighlighted ? "3px solid #38bdf8" : "3px solid transparent",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Clock size={13} style={{ color: isHighlighted ? "#38bdf8" : "#64748b" }} />
                        <span>{item}</span>
                      </div>
                      <ArrowUpRight size={12} style={{ color: "#475569", opacity: isHighlighted ? 1 : 0.4 }} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Trending Searches */}
            {trending.length > 0 && (
              <div style={{ padding: "4px 0" }}>
                <div style={{
                  padding: "6px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <TrendingUp size={11} style={{ color: "#f43f5e" }} />
                  Trending Searches
                </div>
                {trending.map((item, idx) => {
                  const offset = isQueryEmpty ? recentSearches.length : suggestions.length;
                  const globalIdx = offset + idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  return (
                    <div
                      key={`trend-${idx}`}
                      onClick={() => executeSearch(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      style={{
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: isHighlighted ? "#ffffff" : "#cbd5e1",
                        background: isHighlighted ? "rgba(244, 63, 94, 0.2)" : "transparent",
                        borderLeft: isHighlighted ? "3px solid #f43f5e" : "3px solid transparent",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <TrendingUp size={13} style={{ color: isHighlighted ? "#f43f5e" : "#64748b" }} />
                        <span>{item}</span>
                      </div>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "10px",
                        background: "rgba(244, 63, 94, 0.15)",
                        color: "#fb7185",
                        border: "1px solid rgba(244, 63, 94, 0.3)"
                      }}>
                        HOT
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filter Pills (only after search) ── */}
      {hasSearched && results.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {(
            [
              { id: "all", label: "🔍 All", count: results.length },
              { id: "news", label: "📰 News", count: newsCount },
              { id: "web", label: "🌐 Web", count: webCount },
              { id: "videos", label: "▶️ Videos", count: videoCount },
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
            {engines.includes("youtube") && (
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                ▶️ YouTube
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

            if (r.is_video) {
              return (
                <div
                  key={`${r.link}-${_i}`}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    transition: "all 0.18s ease",
                    display: "flex",
                    gap: "14px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.06)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                  }}
                >
                  {/* Video Thumbnail */}
                  {r.thumbnail && (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        borderRadius: "10px",
                        overflow: "hidden",
                        display: "block",
                        width: "140px",
                        height: "78px",
                      }}
                    >
                      <img
                        src={r.thumbnail}
                        alt={r.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: "rgba(239, 68, 68, 0.9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: "12px",
                            paddingLeft: "2px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                          }}
                        >
                          ▶
                        </div>
                      </div>
                    </a>
                  )}

                  {/* Video Details */}
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, padding: "1px 7px", borderRadius: "5px", background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" }}>
                        ▶️ YouTube
                      </span>
                      {r.channel && (
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                          {r.channel}
                        </span>
                      )}
                    </div>

                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none", display: "block", marginBottom: "6px" }}
                    >
                      <h3
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#f1f5f9",
                          lineHeight: 1.4,
                          margin: 0,
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#f1f5f9"; }}
                      >
                        {r.title}
                      </h3>
                    </a>

                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", margin: "0 0 10px 0" }}>
                      {r.snippet}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={(e) => handleSparklesClick(e, r.title, r.snippet)}
                        style={{
                          display: "flex", alignItems: "center", gap: "5px",
                          padding: "4px 10px", borderRadius: "7px", fontSize: "11px",
                          fontWeight: 700, cursor: "pointer",
                          background: "rgba(168,85,247,0.12)",
                          border: "1px solid rgba(168,85,247,0.28)",
                          color: "#c084fc", transition: "all 0.18s ease",
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
                          padding: "4px 10px", borderRadius: "7px", fontSize: "11px",
                          fontWeight: 600, color: "#f87171",
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.25)",
                          textDecoration: "none", transition: "all 0.18s ease",
                        }}
                      >
                        Watch Video <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            }

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
