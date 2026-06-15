"use client";
import { FileText, Loader2, ChevronDown, Download, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

interface ReportItem {
  filename: string;
  url: string;
  size: number;
  created_at: number;
}

export default function ReportHeaderButton() {
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch compiled reports
  const fetchReports = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/report/list");
      const data = await res.json();
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error("Error fetching reports history:", err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/report/", {
        method: "POST",
      });
      const data = await res.json();

      showToast("success", data.message || "Report generated successfully!");

      // Auto-open the PDF in a new tab
      if (data.url) {
        window.open(data.url, "_blank");
      }

      // Refresh list
      fetchReports();
    } catch {
      showToast("error", "Failed to generate report. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      {/* Main Report Button */}
      <button
        type="button"
        onClick={generateReport}
        disabled={loading}
        className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-l-xl transition-all duration-200"
        style={{
          color: "#ffffff",
          background: loading
            ? "rgba(34,211,238,0.3)"
            : "rgba(34,211,238,0.18)",
          border: "1px solid rgba(34,211,238,0.5)",
          borderRight: "none",
          backdropFilter: "blur(8px)",
          boxShadow: "0 0 16px rgba(34,211,238,0.1)",
          cursor: loading ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = "rgba(34,211,238,0.25)";
            b.style.borderColor = "rgba(34,211,238,0.7)";
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = "rgba(34,211,238,0.18)";
            b.style.borderColor = "rgba(34,211,238,0.5)";
          }
        }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {loading ? "Generating..." : "Report"}
      </button>

      {/* History Trigger Dropdown Button */}
      <button
        type="button"
        onClick={() => {
          setDropdownOpen(!dropdownOpen);
          if (!dropdownOpen) fetchReports();
        }}
        className="flex items-center justify-center w-8 py-2 rounded-r-xl transition-all duration-200"
        style={{
          height: "38px", // Align height with the main button
          color: "#ffffff",
          background: "rgba(34,211,238,0.18)",
          border: "1px solid rgba(34,211,238,0.5)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = "rgba(34,211,238,0.25)";
          b.style.borderColor = "rgba(34,211,238,0.7)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = "rgba(34,211,238,0.18)";
          b.style.borderColor = "rgba(34,211,238,0.5)";
        }}
      >
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 shadow-2xl rounded-2xl z-50 p-4"
          style={{
            background: "rgba(15,15,22,0.96)",
            backdropFilter: "blur(25px)",
            border: "1px solid rgba(34,211,238,0.3)",
            animation: "slideDownFade 0.2s ease",
          }}
        >
          <div className="flex items-center justify-between pb-3 border-bottom border-white/10 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Report History
            </span>
            <span className="text-[10px] text-white/40">
              {reports.length} files
            </span>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-6 text-white/50 text-xs">
              No reports generated yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {reports.map((rep, idx) => (
                <div
                  key={idx}
                  onClick={() => window.open(rep.url, "_blank")}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-cyan-500/30 cursor-pointer transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                      <span className="text-red-400 text-xs font-bold">
                        PDF
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {rep.filename}
                      </p>
                      <p className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(rep.created_at * 1000).toLocaleDateString()} ·{" "}
                        {formatBytes(rep.size)}
                      </p>
                    </div>
                  </div>
                  <Download className="w-3.5 h-3.5 text-cyan-400 hover:text-white flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
