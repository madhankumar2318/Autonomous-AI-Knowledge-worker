"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StockSection() {
  const [stock, setStock] = useState<any>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/stock?symbol=AAPL")
      .then((res) => res.json())
      .then((data) => setStock(data))
      .catch((err) => {
        console.error("Stock fetch error:", err);
        setStock({ error: err.message });
      });
  }, []);

  if (!stock) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-6 w-24"></div>
        <div className="skeleton h-8 w-32"></div>
        <div className="skeleton h-4 w-20"></div>
      </div>
    );
  }

  if (stock.error) {
    return (
      <div className="alert alert-error">
        <p className="text-sm">Error: {stock.error}</p>
      </div>
    );
  }

  const isPositive = stock.change_percent && stock.change_percent.includes("+");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted mb-1">Symbol</p>
          <p className="text-lg font-bold text-primary">{stock.symbol}</p>
        </div>
        {isPositive !== undefined && (
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full ${
              isPositive
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-semibold">
              {stock.change_percent}
            </span>
          </div>
        )}
      </div>

      <div className="bg-surface p-4 rounded-lg">
        <p className="text-xs text-muted mb-1">Current Price</p>
        <p className="text-2xl font-bold text-primary">${stock.price}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface p-3 rounded-lg">
          <p className="text-xs text-muted mb-1">High</p>
          <p className="text-sm font-semibold text-primary">
            ${stock.high || "N/A"}
          </p>
        </div>
        <div className="bg-surface p-3 rounded-lg">
          <p className="text-xs text-muted mb-1">Low</p>
          <p className="text-sm font-semibold text-primary">
            ${stock.low || "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
