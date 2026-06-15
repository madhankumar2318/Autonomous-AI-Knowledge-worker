"use client";
import {
  CloudUpload,
  Download,
  File,
  FileJson,
  FileText,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

interface UploadedFile {
  id: number;
  filename: string;
  size: number;
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "json")
    return <FileJson className="w-5 h-5" style={{ color: "#fbbf24" }} />;
  if (ext === "csv")
    return <FileText className="w-5 h-5" style={{ color: "#34d399" }} />;
  return <File className="w-5 h-5" style={{ color: "#22d3ee" }} />;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
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

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 15, 85));
    }, 150);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        body: formData,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (res.ok) {
        setTimeout(() => {
          setFile(null);
          setUploadProgress(0);
          showToast("success", `"${file.name}" uploaded successfully!`);
          fetchUploads();
        }, 500);
      } else {
        showToast("error", "Upload failed. Please try again.");
        setUploadProgress(0);
      }
    } catch (_err) {
      clearInterval(progressInterval);
      showToast("error", "Upload error — check if the backend is running.");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fw-root">
      {/* ── HEADER ── */}
      <div className="fw-header">
        <div className="fw-header-icon">
          <FolderOpen className="w-5 h-5" style={{ color: "#fbbf24" }} />
        </div>
        <div>
          <h2 className="fw-title">File Workspace</h2>
          <p className="fw-subtitle">Upload CSV or JSON files to analyze with the AI Agent</p>
        </div>
        <button
          type="button"
          onClick={fetchUploads}
          className="fw-refresh-btn"
          title="Refresh file list"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="fw-layout">
        {/* Upload Panel */}
        <div className="fw-upload-panel">
          <div className="fw-panel-title">Upload New File</div>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`fw-dropzone ${isDragging ? "fw-dropzone-dragging" : ""} ${file ? "fw-dropzone-ready" : ""}`}
          >
            <div className="fw-dropzone-icon">
              <CloudUpload
                className="w-8 h-8"
                style={{ color: isDragging ? "#22d3ee" : file ? "#34d399" : "rgba(255,255,255,0.25)" }}
              />
            </div>

            {file ? (
              <div className="fw-file-preview">
                <div className="fw-file-preview-name">
                  <FileIcon filename={file.name} />
                  <span>{file.name}</span>
                </div>
                <div className="fw-file-preview-size">{formatSize(file.size)}</div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="fw-file-clear"
                  aria-label="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <p className="fw-dropzone-text">
                  {isDragging ? (
                    "Drop it here!"
                  ) : (
                    <>
                      <label htmlFor="file-upload" className="fw-dropzone-link">
                        Click to browse
                      </label>
                      {" or drag & drop"}
                    </>
                  )}
                </p>
                <p className="fw-dropzone-hint">CSV or JSON files · Max 50MB</p>
              </>
            )}

            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-upload"
              accept=".csv,.json"
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="fw-progress-wrap">
              <div className="fw-progress-bar-bg">
                <div
                  className="fw-progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="fw-progress-label">{uploadProgress}%</span>
            </div>
          )}

          {/* Upload Button */}
          {file && !uploading && (
            <button
              type="button"
              onClick={handleUpload}
              className="fw-upload-btn"
            >
              <CloudUpload className="w-4 h-4" />
              Upload to Workspace
            </button>
          )}

          {/* Supported types */}
          <div className="fw-format-badges">
            <div className="fw-format-badge" style={{ borderColor: "rgba(52,211,153,0.3)", color: "#34d399", background: "rgba(52,211,153,0.08)" }}>
              <FileText className="w-3 h-3" /> CSV
            </div>
            <div className="fw-format-badge" style={{ borderColor: "rgba(251,191,36,0.3)", color: "#fbbf24", background: "rgba(251,191,36,0.08)" }}>
              <FileJson className="w-3 h-3" /> JSON
            </div>
          </div>
        </div>

        {/* Files Panel */}
        <div className="fw-files-panel">
          <div className="fw-panel-header">
            <div className="fw-panel-title">Workspace Documents</div>
            <span className="fw-file-count">{uploads.length} file{uploads.length !== 1 ? "s" : ""}</span>
          </div>

          {uploads.length === 0 ? (
            <div className="fw-files-empty">
              <div className="fw-files-empty-icon">
                <FolderOpen className="w-6 h-6" style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
              <p className="fw-files-empty-text">No files uploaded yet</p>
              <p className="fw-files-empty-sub">Upload a CSV or JSON file to get started</p>
            </div>
          ) : (
            <div className="fw-files-list">
              {uploads.map((u) => (
                <div key={u.id} className="fw-file-item">
                  <div className="fw-file-icon-wrap">
                    <FileIcon filename={u.filename} />
                  </div>
                  <div className="fw-file-info">
                    <div className="fw-file-name">{u.filename}</div>
                    <div className="fw-file-meta">
                      <span className="fw-file-ext-badge">
                        {u.filename.split(".").pop()?.toUpperCase()}
                      </span>
                      <span className="fw-file-size">{formatSize(u.size)}</span>
                    </div>
                  </div>
                  <div className="fw-file-actions">
                    <a
                      href={`http://127.0.0.1:8000/uploads/${u.filename}`}
                      download
                      className="fw-file-action-btn"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Hint */}
          {uploads.length > 0 && (
            <div className="fw-ai-hint">
              <div className="fw-ai-hint-icon">
                <Zap className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
              </div>
              <div className="fw-ai-hint-text">
                <span className="fw-ai-hint-title">AI Analysis Ready</span>
                <span className="fw-ai-hint-sub">
                  Open the AI Chat Agent and ask it to analyze, merge, or calculate data from your uploaded files.
                </span>
              </div>
              <MessageSquare className="w-4 h-4" style={{ color: "rgba(34,211,238,0.4)", flexShrink: 0 }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fw-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── HEADER ── */
        .fw-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
        }
        .fw-header-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(251,191,36,0.1);
          border: 1px solid rgba(251,191,36,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fw-title { font-size: 15px; font-weight: 700; color: #fff; }
        .fw-subtitle { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .fw-refresh-btn {
          margin-left: auto;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.35);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .fw-refresh-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

        /* ── LAYOUT ── */
        .fw-layout {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .fw-layout { grid-template-columns: 1fr; }
        }

        /* ── PANELS ── */
        .fw-panel-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .fw-upload-panel, .fw-files-panel {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── DROP ZONE ── */
        .fw-dropzone {
          border: 2px dashed rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          background: rgba(255,255,255,0.015);
          transition: all 0.22s ease;
          cursor: pointer;
          position: relative;
        }
        .fw-dropzone-dragging {
          border-color: rgba(34,211,238,0.6) !important;
          background: rgba(34,211,238,0.07) !important;
          box-shadow: 0 0 0 3px rgba(34,211,238,0.1), inset 0 0 40px rgba(34,211,238,0.05);
        }
        .fw-dropzone-ready {
          border-color: rgba(52,211,153,0.4) !important;
          background: rgba(52,211,153,0.04) !important;
        }
        .fw-dropzone-icon {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .fw-dropzone-text {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
        }
        .fw-dropzone-link {
          color: #22d3ee;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .fw-dropzone-hint {
          font-size: 11px;
          color: rgba(255,255,255,0.22);
        }

        /* ── FILE PREVIEW ── */
        .fw-file-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .fw-file-preview-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          word-break: break-all;
          text-align: center;
        }
        .fw-file-preview-size {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .fw-file-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          color: #f87171;
          cursor: pointer;
          transition: all 0.15s;
        }
        .fw-file-clear:hover { background: rgba(239,68,68,0.2); }

        /* ── PROGRESS ── */
        .fw-progress-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fw-progress-bar-bg {
          flex: 1;
          height: 5px;
          border-radius: 99px;
          background: rgba(255,255,255,0.07);
          overflow: hidden;
        }
        .fw-progress-bar {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #22d3ee, #0891b2);
          transition: width 0.2s ease;
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
        }
        .fw-progress-label {
          font-size: 11px;
          color: #22d3ee;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          min-width: 30px;
        }

        /* ── UPLOAD BTN ── */
        .fw-upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 11px;
          border-radius: 12px;
          background: linear-gradient(135deg, #22d3ee, #0891b2);
          border: none;
          font-size: 13px;
          font-weight: 700;
          color: #030f1a;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(34,211,238,0.3);
        }
        .fw-upload-btn:hover {
          box-shadow: 0 6px 24px rgba(34,211,238,0.5);
          transform: translateY(-1px);
        }

        /* ── FORMAT BADGES ── */
        .fw-format-badges {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .fw-format-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 7px;
          border: 1px solid;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        /* ── FILES PANEL ── */
        .fw-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0;
        }
        .fw-file-count {
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .fw-files-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 8px;
          text-align: center;
          border: 1px dashed rgba(255,255,255,0.07);
          border-radius: 12px;
          background: rgba(255,255,255,0.01);
        }
        .fw-files-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fw-files-empty-text { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.4); }
        .fw-files-empty-sub { font-size: 11px; color: rgba(255,255,255,0.2); }

        .fw-files-list { display: flex; flex-direction: column; gap: 8px; }
        .fw-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.15s ease;
        }
        .fw-file-item:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }
        .fw-file-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fw-file-info { flex: 1; min-width: 0; }
        .fw-file-name {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fw-file-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
        .fw-file-ext-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(34,211,238,0.15);
          color: #67e8f9;
          border: 1px solid rgba(34,211,238,0.25);
          letter-spacing: 0.5px;
        }
        .fw-file-size { font-size: 10px; color: rgba(255,255,255,0.3); }
        .fw-file-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .fw-file-action-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .fw-file-action-btn:hover { background: rgba(34,211,238,0.12); border-color: rgba(34,211,238,0.3); color: #22d3ee; }

        /* ── AI HINT ── */
        .fw-ai-hint {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(34,211,238,0.06);
          border: 1px solid rgba(34,211,238,0.15);
        }
        .fw-ai-hint-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(34,211,238,0.12);
          border: 1px solid rgba(34,211,238,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fw-ai-hint-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .fw-ai-hint-title { font-size: 11px; font-weight: 700; color: #67e8f9; }
        .fw-ai-hint-sub { font-size: 10px; color: rgba(255,255,255,0.35); line-height: 1.5; }
      `}</style>
    </div>
  );
}
