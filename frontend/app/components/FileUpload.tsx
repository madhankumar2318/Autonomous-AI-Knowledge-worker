"use client";
import { Download, File, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<
    { id: number; filename: string; size: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // 🔹 Fetch uploaded files
  const fetchUploads = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/upload/list");
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch (_err) {
      console.error("Error fetching uploads:", _err);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only mount once
  useEffect(() => {
    fetchUploads();
  }, []);

  // 🔹 Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const ext = dropped.name.split(".").pop()?.toLowerCase();
      if (ext === "csv" || ext === "json") {
        setFile(dropped);
      } else {
        showToast("error", "Only CSV or JSON files are allowed.");
      }
    }
  };

  // 🔹 Upload file
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setFile(null);
        showToast("success", `"${file.name}" uploaded successfully!`);
        fetchUploads();
      } else {
        showToast("error", "Upload failed. Please try again.");
      }
    } catch (_err) {
      showToast("error", "Upload error — check if the backend is running.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Drop Zone — grows to fill all available space */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          flex: 1,
          borderColor: isDragging
            ? "var(--accent-primary)"
            : file
              ? "var(--accent-success)"
              : "rgba(255,255,255,0.15)",
          background: isDragging
            ? "rgba(168, 85, 247, 0.08)"
            : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80px",
        }}
        className="border-2 border-dashed rounded-xl text-center"
      >
        <Upload
          className="w-7 h-7 mb-3"
          style={{ color: isDragging ? "var(--accent-primary)" : "var(--text-muted)" }}
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-upload"
          accept=".csv,.json"
        />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="p-0.5 rounded hover:bg-white/10"
              aria-label="Clear file"
            >
              <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        ) : (
          <label htmlFor="file-upload" className="cursor-pointer">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--accent-primary)" }}>
                Choose a file
              </span>{" "}
              or drag &amp; drop here
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              CSV or JSON files only
            </p>
          </label>
        )}
      </div>

      {file && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
          style={{ marginTop: "10px", flexShrink: 0 }}
        >
          {uploading ? (
            <>
              <div className="spinner" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload File
            </>
          )}
        </button>
      )}

      {/* Uploaded Files List */}
      {uploads.length > 0 && (
        <div style={{ marginTop: "10px", flexShrink: 0 }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Uploaded Files
          </h3>
          <div className="space-y-1">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2 rounded-lg transition-colors"
                style={{ background: "var(--bg-surface)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)"; }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent-primary)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {u.filename}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {Math.round(u.size / 1024)} KB
                    </p>
                  </div>
                </div>
                <a
                  href={`http://127.0.0.1:8000/uploads/${u.filename}`}
                  download
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" style={{ color: "var(--accent-primary)" }} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
