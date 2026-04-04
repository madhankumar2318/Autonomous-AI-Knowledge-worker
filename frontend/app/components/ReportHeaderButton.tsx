"use client";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { showToast } from "./Toast";

export default function ReportHeaderButton() {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/report/", { method: "POST" });
      const data = await res.json();
      showToast("success", data.message || "Report generated successfully!");
    } catch {
      showToast("error", "Failed to generate report. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={generateReport}
      disabled={loading}
      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
      style={{
        color: "#ffffff",
        background: loading ? "rgba(168,85,247,0.3)" : "rgba(168,85,247,0.18)",
        border: loading ? "1px solid rgba(168,85,247,0.1)" : "1px solid rgba(168,85,247,0.5)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 0 16px rgba(168,85,247,0.2)",
        cursor: loading ? "not-allowed" : "pointer"
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = "rgba(168,85,247,0.25)";
          b.style.borderColor = "rgba(168,85,247,0.7)";
          b.style.boxShadow = "0 0 20px rgba(168,85,247,0.4)";
          b.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = "rgba(168,85,247,0.18)";
          b.style.borderColor = "rgba(168,85,247,0.5)";
          b.style.boxShadow = "0 0 16px rgba(168,85,247,0.2)";
          b.style.transform = "translateY(0)";
        }
      }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {loading ? "Generating..." : "Report"}
    </button>
  );
}
