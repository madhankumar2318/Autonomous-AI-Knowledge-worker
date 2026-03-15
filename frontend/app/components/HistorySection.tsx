"use client";
import { useEffect, useState } from "react";
import { Clock, Activity } from "lucide-react";

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

  useEffect(() => {
    fetchHistory();
  }, []);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn btn-ghost flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Activity
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 card shadow-lg z-50">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">
                No recent activity
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-surface rounded-lg hover:bg-hover transition-colors"
                  >
                    <p className="text-sm text-primary font-medium line-clamp-2">
                      {item.action}
                    </p>
                    <p className="text-xs text-muted mt-1">
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
        <Clock className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold">Activity History</h2>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-secondary">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="card-compact hover:shadow-md transition-all"
            >
              <p className="text-sm text-primary font-medium mb-2">
                {item.action}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted">
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
