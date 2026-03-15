"use client";
import { useState } from "react";
import { Search, ExternalLink, AlertCircle } from "lucide-react";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export default function SearchSection({
  infiniteScroll = false,
}: { infiniteScroll?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const fetchSearch = async (q: string, pageNum: number) => {
    if (!q) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/search?query=${encodeURIComponent(q)}&page=${pageNum}`
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
        "Failed to connect to search service. Please check if the backend is running."
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!infiniteScroll) return;
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 50;
    if (bottom) {
      setPage((p) => {
        const next = p + 1;
        fetchSearch(query, next);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
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
        <button
          type="submit"
          onClick={handleSearch}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? <div className="spinner"></div> : "Search"}
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
        <div className="flex flex-col items-center justify-center py-12">
          <div className="spinner mb-3"></div>
          <p className="text-sm text-muted">Searching...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && !error && hasSearched && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
            <Search className="w-6 h-6 text-muted" />
          </div>
          <p className="text-sm text-secondary">No results found for "{query}"</p>
          <p className="text-xs text-muted mt-1">Try different keywords</p>
        </div>
      )}

      {/* Results */}
      <div
        className="overflow-y-auto space-y-3 flex-1"
        onScroll={handleScroll}
      >
        {results.map((r, i) => (
          <div
            key={i}
            className="card-compact hover:border-accent transition-all group"
          >
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-accent group-hover:underline line-clamp-2 mb-1">
                  {r.title}
                </h3>
                <p className="text-xs text-secondary line-clamp-2">
                  {r.snippet}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
