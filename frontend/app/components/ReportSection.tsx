"use client";
import { CheckCircle, FileText } from "lucide-react";
import { useState } from "react";
import { showToast } from "./Toast";

export default function ReportSection() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("http://127.0.0.1:8000/report/", {
        method: "POST",
      });
      const data = await res.json();
      setMessage(data.message || "Report generated!");
      showToast("success", data.message || "Report generated!");
    } catch (_err) {
      setMessage("Failed to generate report");
      showToast("error", "Failed to generate report. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={generateReport}
        disabled={loading}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="spinner"></div>
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Generate Report
          </>
        )}
      </button>

      {message && (
        <div className="alert alert-success flex items-start gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{message}</span>
        </div>
      )}
    </div>
  );
}
