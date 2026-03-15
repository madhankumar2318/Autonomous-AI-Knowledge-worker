"use client";
import React, { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";

type NewsItem = { title: string; description?: string; url?: string };
type UploadItem = { id: number; filename: string; filepath: string };

export default function ReportBuilder() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<number[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selectedUploads, setSelectedUploads] = useState<string[]>([]);
  const [stockSymbol, setStockSymbol] = useState("");
  const [building, setBuilding] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("Custom Report");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/news?page=1")
      .then((r) => r.json())
      .then((d) => {
        setNews(d.news || []);
      })
      .catch((e) => console.error(e));

    fetch("http://127.0.0.1:8000/upload/list")
      .then((r) => r.json())
      .then((d) => setUploads(d.uploads || []))
      .catch((e) => console.error(e));
  }, []);

  const toggleNews = (idx: number) => {
    setSelectedNews((s) =>
      s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]
    );
  };

  const toggleUpload = (fname: string) => {
    setSelectedUploads((s) =>
      s.includes(fname) ? s.filter((x) => x !== fname) : [...s, fname]
    );
  };

  const handleBuild = async () => {
    setBuilding(true);
    setResultUrl(null);

    const selectedNewsItems = selectedNews.map((i) => news[i]).filter(Boolean);

    let stockData = undefined;
    if (stockSymbol.trim()) {
      try {
        const r = await fetch(
          `http://127.0.0.1:8000/stock?symbol=${encodeURIComponent(stockSymbol)}`
        );
        const sd = await r.json();
        if (sd && sd.symbol) stockData = sd;
      } catch (_) { }
    }

    const payload = {
      title,
      news: selectedNewsItems,
      stock: stockData || null,
      uploads: selectedUploads,
      notes: "",
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/report/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.url) {
        setResultUrl(data.url);
      } else if (data.filename) {
        setResultUrl(`/reports/${data.filename}`);
      } else {
        alert("Report created but no URL returned.");
      }
    } catch (e) {
      alert("Error building report: " + String(e));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-primary mb-2">
          Report Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
        />
      </div>

      {/* News Selection */}
      <div>
        <h4 className="font-semibold text-primary mb-3">
          Select News (first page)
        </h4>
        <div className="max-h-64 overflow-y-auto space-y-2 border border-light rounded-lg p-4 bg-surface">
          {news.length === 0 && (
            <p className="text-sm text-muted">No news loaded</p>
          )}
          {news.map((n, i) => (
            <label
              key={i}
              className="flex items-start gap-3 p-3 bg-secondary rounded-lg hover:bg-hover transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedNews.includes(i)}
                onChange={() => toggleNews(i)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-primary">
                  {n.title}
                </div>
                <div className="text-xs text-secondary line-clamp-2 mt-1">
                  {n.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Uploads Selection */}
      <div>
        <h4 className="font-semibold text-primary mb-3">Select Uploads</h4>
        <div className="max-h-48 overflow-y-auto border border-light rounded-lg p-4 bg-surface">
          {uploads.length === 0 && (
            <p className="text-sm text-muted">No uploads</p>
          )}
          {uploads.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-3 p-2 hover:bg-hover rounded-lg transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedUploads.includes(u.filename)}
                onChange={() => toggleUpload(u.filename)}
              />
              <span className="text-sm text-primary">{u.filename}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock Symbol */}
      <div>
        <label className="block text-sm font-medium text-primary mb-2">
          Stock Symbol (optional)
        </label>
        <input
          value={stockSymbol}
          onChange={(e) => setStockSymbol(e.target.value)}
          placeholder="e.g. AAPL"
          className="input"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleBuild}
          disabled={building}
          className="btn btn-success flex items-center gap-2"
        >
          {building ? (
            <>
              <div className="spinner"></div>
              Building...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Build Report
            </>
          )}
        </button>
        {resultUrl && (
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Report
          </a>
        )}
      </div>
    </div>
  );
}
