"use client";
import { Activity, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HistoryItem {
  id: number;
  action: string;
  created_at: string;
}

interface Props {
  limit?: number;
  compact?: boolean;
}

export default function HistorySection({ limit, compact }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/history/list");
      const data = await res.json();
      if (data.history) {
        let items = data.history as HistoryItem[];
        if (limit) {
          items = items.slice(0, limit);
        }
        setHistory(items);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only mount once
  useEffect(() => {
    fetchHistory();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchHistory();
          }}
          className="flex items-center gap-2 text-sm font-semibold px-4 rounded-xl transition-all duration-200"
          style={{
            height: "38px", // Align height with other header buttons
            color: isOpen ? "#67e8f9" : "#22d3ee",
            background: isOpen
              ? "rgba(34,211,238,0.18)"
              : "rgba(34,211,238,0.10)",
            border: `1px solid ${isOpen ? "rgba(34,211,238,0.55)" : "rgba(34,211,238,0.25)"}`,
            backdropFilter: "blur(8px)",
            boxShadow: isOpen ? "0 0 16px rgba(34,211,238,0.3)" : "none",
          }}
          aria-expanded={isOpen}
          aria-haspopup="true"
          onMouseEnter={(e) => {
            if (!isOpen) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = "#ffffff";
              b.style.background = "rgba(34,211,238,0.22)";
              b.style.borderColor = "rgba(34,211,238,0.55)";
              b.style.boxShadow = "0 0 16px rgba(34,211,238,0.3)";
              b.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.color = "#22d3ee";
              b.style.background = "rgba(34,211,238,0.10)";
              b.style.borderColor = "rgba(34,211,238,0.25)";
              b.style.boxShadow = "none";
              b.style.transform = "translateY(0)";
            }
          }}
        >
          {/* Pulsing live dot */}
          <span
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 6px #4ade80",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
          </span>
          <Activity className="w-4 h-4" />
          Activity
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 card shadow-lg z-50"
            role="menu"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock
                  className="w-4 h-4"
                  style={{ color: "var(--accent-primary)" }}
                />
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  Recent Activity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Close
              </button>
            </div>

            {history.length === 0 ? (
              <p
                className="text-sm text-center py-4"
                style={{ color: "var(--text-muted)" }}
              >
                No recent activity
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg transition-colors"
                    style={{ background: "var(--bg-surface)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--bg-surface)";
                    }}
                  >
                    <p
                      className="text-sm font-medium line-clamp-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.action}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Activity History
        </h2>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <Activity
            className="w-12 h-12 mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>No activity yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="card-compact hover:shadow-md transition-all"
            >
              <p
                className="text-sm font-medium mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {item.action}
              </p>
              <div
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <Clock className="w-3 h-3" />
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
