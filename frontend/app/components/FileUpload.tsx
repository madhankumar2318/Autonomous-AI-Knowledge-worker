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
  RotateCw,
  Trash2,
  X,
  Zap,
  Brain,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";
import { API_BASE_URL } from "../config";
import DocumentWorkspace from "./DocumentWorkspace";

interface UploadedFile {
  id: number;
  filename: string;
  size: number;
  uploaded_at?: string;
  rag_indexed?: boolean;
  chunks?: number;
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "json")
    return <FileJson className="w-5 h-5" style={{ color: "#fbbf24" }} />;
  if (ext === "csv")
    return <FileText className="w-5 h-5" style={{ color: "#34d399" }} />;
  if (ext === "pdf")
    return <FileText className="w-5 h-5" style={{ color: "#f87171" }} />;
  if (ext === "txt" || ext === "md")
    return <FileText className="w-5 h-5" style={{ color: "#c084fc" }} />;
  return <File className="w-5 h-5" style={{ color: "#22d3ee" }} />;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

interface FileUploadProps {
  username?: string;
}

export default function FileUpload({ username = "guest" }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeWorkspaceFile, setActiveWorkspaceFile] = useState<UploadedFile | null>(null);
  const [workspaceHighlightPhrase, setWorkspaceHighlightPhrase] = useState<string>("");
  const [workspaceHighlightPage, setWorkspaceHighlightPage] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const [reindexingFiles, setReindexingFiles] = useState<Set<string>>(new Set());

  const fetchUploads = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/upload/list`, {
        credentials: "include",
      });
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

  useEffect(() => {
    const handleOpenDocument = (e: Event) => {
      const customEvent = e as CustomEvent<{ filename: string; phrase?: string; pageNum?: number }>;
      const { filename, phrase, pageNum } = customEvent.detail;
      setWorkspaceHighlightPhrase(phrase || "");
      setWorkspaceHighlightPage(pageNum || null);
      const matched = uploads.find((u) => u.filename === filename);
      if (matched) {
        setActiveWorkspaceFile(matched);
      } else {
        // Fallback: construct a temporary UploadedFile object if not loaded yet
        setActiveWorkspaceFile({
          id: 0,
          filename: filename,
          size: 0,
          rag_indexed: true,
        });
      }
    };
    window.addEventListener("open-rag-document", handleOpenDocument);
    return () => {
      window.removeEventListener("open-rag-document", handleOpenDocument);
    };
  }, [uploads]);

  useEffect(() => {
    if (activeWorkspaceFile) {
      localStorage.setItem("ak_active_file", activeWorkspaceFile.filename);
    } else {
      localStorage.removeItem("ak_active_file");
    }
  }, [activeWorkspaceFile]);

  useEffect(() => {
    if (uploads.length > 0 && !activeWorkspaceFile) {
      const savedFilename = localStorage.getItem("ak_active_file");
      if (savedFilename) {
        const matched = uploads.find((u) => u.filename === savedFilename);
        if (matched) {
          setActiveWorkspaceFile(matched);
        }
      }
    }
  }, [uploads, activeWorkspaceFile]);

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
      if (ext && ["csv", "json", "pdf", "txt", "md"].includes(ext)) {
        setFile(dropped);
      } else {
        showToast("error", "Supported formats: CSV, JSON, PDF, TXT, MD.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 150);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (res.ok) {
        const data = await res.json();
        setTimeout(() => {
          setFile(null);
          setUploadProgress(0);
          
          if (data.rag_status === "success") {
            showToast("success", `"${file.name}" uploaded & RAG indexed successfully!`);
            window.dispatchEvent(new CustomEvent("ak-add-notification", {
              detail: { title: "RAG Document Indexed", message: `"${file.name}" has been fully parsed and indexed for semantic searches.`, type: "success" }
            }));
          } else if (data.rag_status === "keyword_only") {
            showToast("success", `"${file.name}" uploaded & indexed! (Keyword search active — semantic search needs Gemini API key.)`);
            window.dispatchEvent(new CustomEvent("ak-add-notification", {
              detail: { title: "Document Keyword-Indexed", message: `"${file.name}" indexed for keyword matching. Connect a Gemini key to activate semantic searches.`, type: "info" }
            }));
          } else if (data.rag_status === "failed") {
            showToast("warning", `Uploaded "${file.name}", but indexing failed: ${data.error || "Check server logs."}`);
            window.dispatchEvent(new CustomEvent("ak-add-notification", {
              detail: { title: "Document Indexing Failed", message: `"${file.name}" uploaded but indexing failed: ${data.error || "unknown error"}`, type: "warning" }
            }));
          } else {
            showToast("success", `"${file.name}" uploaded successfully!`);
            window.dispatchEvent(new CustomEvent("ak-add-notification", {
              detail: { title: "File Uploaded", message: `"${file.name}" uploaded successfully to workspace.`, type: "success" }
            }));
          }
          fetchUploads();
        }, 500);
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast("error", errorData.error || "Upload failed. Please try again.");
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

  const handleReindex = async (filename: string) => {
    setReindexingFiles((prev) => new Set(prev).add(filename));
    try {
      const res = await fetch(`${API_BASE_URL}/upload/reindex/${encodeURIComponent(filename)}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.rag_status === "success") {
          showToast("success", `"${filename}" re-indexed successfully with ${data.chunks} chunks!`);
          window.dispatchEvent(new CustomEvent("ak-add-notification", {
            detail: { title: "Document Re-indexed", message: `"${filename}" re-parsed successfully into ${data.chunks} chunks.`, type: "success" }
          }));
        } else if (data.rag_status === "keyword_only") {
          showToast("success", `"${filename}" indexed for keyword search (${data.chunks} chunks).`);
          window.dispatchEvent(new CustomEvent("ak-add-notification", {
            detail: { title: "Document Keyword-Indexed", message: `"${filename}" re-indexed for keyword search. Connect Gemini key to activate semantic index.`, type: "info" }
          }));
        } else {
          showToast("warning", `Re-indexing failed: ${data.error || "Unknown error"}`);
          window.dispatchEvent(new CustomEvent("ak-add-notification", {
            detail: { title: "Re-indexing Failed", message: `Failed to re-index "${filename}": ${data.error}`, type: "warning" }
          }));
        }
        fetchUploads();
      } else {
        showToast("error", data.detail || "Re-indexing failed.");
        window.dispatchEvent(new CustomEvent("ak-add-notification", {
          detail: { title: "Re-indexing Failed", message: `Server error during re-indexing: ${data.detail}`, type: "warning" }
        }));
      }
    } catch (_err) {
      showToast("error", "Connection error during re-indexing.");
    } finally {
      setReindexingFiles((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This removes it permanently.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        showToast("success", `"${filename}" removed.`);
        window.dispatchEvent(new CustomEvent("ak-add-notification", {
          detail: { title: "Document Removed", message: `"${filename}" deleted from workspace permanently.`, type: "info" }
        }));
        fetchUploads();
      } else {
        showToast("error", "Failed to delete file.");
        window.dispatchEvent(new CustomEvent("ak-add-notification", {
          detail: { title: "Deletion Failed", message: `Failed to delete file "${filename}" from server storage.`, type: "warning" }
        }));
      }
    } catch (_err) {
      showToast("error", "Connection error during file deletion.");
    }
  };

  return (
    <>
      {/* ── Document Workspace overlay (renders when a file is opened) ── */}
      {activeWorkspaceFile && (
        <DocumentWorkspace
          file={activeWorkspaceFile}
          username={username}
          onClose={() => {
            setActiveWorkspaceFile(null);
            setWorkspaceHighlightPhrase("");
            setWorkspaceHighlightPage(null);
          }}
          highlightPhrase={workspaceHighlightPhrase}
          targetPage={workspaceHighlightPage}
        />
      )}

      <div className="fw-root">
      {/* ── HEADER ── */}
      <div className="fw-header">
        <div className="fw-header-icon">
          <FolderOpen className="w-5 h-5" style={{ color: "#fbbf24" }} />
        </div>
        <div>
          <h2 className="fw-title">File Workspace</h2>
          <p className="fw-subtitle">Upload CSV, JSON, PDF, TXT, MD, DOCX, or XLSX files to index with AI Knowledge Worker</p>
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
                style={{ color: isDragging ? "#22d3ee" : file ? "#34d399" : "var(--text-muted)" }}
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
                <p className="fw-dropzone-hint">CSV, JSON, PDF, TXT, MD, DOCX, XLSX · Max 50MB</p>
              </>
            )}

            <input
              type="file"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                if (selected) {
                  const ext = selected.name.split(".").pop()?.toLowerCase();
                  if (ext && ["csv", "json", "pdf", "txt", "md", "docx", "xlsx"].includes(ext)) {
                    setFile(selected);
                  } else {
                    showToast("error", "Only CSV, JSON, PDF, TXT, MD, DOCX, and XLSX formats are supported.");
                  }
                }
              }}
              className="hidden"
              id="file-upload"
              accept=".csv,.json,.pdf,.txt,.md,.docx,.xlsx"
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
              <span className="fw-progress-label">
                {uploadProgress < 100 ? "Indexing..." : "Done!"}
              </span>
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
              Upload & Index RAG
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
            <div className="fw-format-badge" style={{ borderColor: "rgba(248,113,113,0.3)", color: "#f87171", background: "rgba(248,113,113,0.08)" }}>
              <FileText className="w-3 h-3" /> PDF
            </div>
            <div className="fw-format-badge" style={{ borderColor: "rgba(192,132,252,0.3)", color: "#c084fc", background: "rgba(192,132,252,0.08)" }}>
              <FileText className="w-3 h-3" /> TXT/MD
            </div>
            <div className="fw-format-badge" style={{ borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa", background: "rgba(96,165,250,0.08)" }}>
              <FileText className="w-3 h-3" /> DOCX
            </div>
            <div className="fw-format-badge" style={{ borderColor: "rgba(74,222,128,0.3)", color: "#4ade80", background: "rgba(74,222,128,0.08)" }}>
              <FileText className="w-3 h-3" /> XLSX
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
                <FolderOpen className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="fw-files-empty-text">No files uploaded yet</p>
              <p className="fw-files-empty-sub">Upload a CSV, JSON, PDF, TXT, or MD file to index it for semantic search</p>
            </div>
          ) : (
            <div className="fw-files-list">
              {uploads.map((u) => (
                <div key={u.id} className={`fw-file-item premium-card-hover file-glow-${u.filename.split(".").pop()?.toLowerCase() || ""}`}>
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
                      {u.rag_indexed ? (
                        <span className="fw-file-rag-badge" title={`Indexed in AI memory with ${u.chunks || 0} chunks`}>
                          <Brain className="w-3 h-3" style={{ marginRight: '4px', flexShrink: 0 }} />
                          RAG Indexed ({u.chunks || 0} chunks)
                        </span>
                      ) : (
                        <span className="fw-file-rag-badge-pending" title="AI indexing pending or failed">
                          RAG Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="fw-file-actions">
                    {/* Analyze button — only shown when file is RAG-indexed */}
                    {u.rag_indexed && (
                      <button
                        type="button"
                        onClick={() => setActiveWorkspaceFile(u)}
                        className="fw-file-action-btn fw-analyze-btn"
                        title="Open in Document Workspace (AI Chat)"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '3px' }}>Analyze</span>
                      </button>
                    )}
                    {/* Re-index button — shown when file is NOT indexed (RAG Pending) */}
                    {!u.rag_indexed && (
                      <button
                        type="button"
                        onClick={() => handleReindex(u.filename)}
                        disabled={reindexingFiles.has(u.filename)}
                        className="fw-file-action-btn fw-reindex-btn"
                        title="Re-index this file for AI search"
                      >
                        <RotateCw
                          className="w-3.5 h-3.5"
                          style={reindexingFiles.has(u.filename) ? { animation: 'spin 1s linear infinite' } : {}}
                        />
                        <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '3px' }}>
                          {reindexingFiles.has(u.filename) ? 'Indexing...' : 'Re-index'}
                        </span>
                      </button>
                    )}
                    <a
                      href={`${API_BASE_URL}/upload/download/${u.filename}`}
                      className="fw-file-action-btn"
                      title="Download File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(u.filename)}
                      className="fw-file-action-btn fw-delete-btn"
                      title="Delete from workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                <span className="fw-ai-hint-title">AI Knowledge Base Active</span>
                <span className="fw-ai-hint-sub">
                  Ask the AI Chat widget a question like: "what was in the report I uploaded?" or "search my documents for APC results".
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
          flex: 1;
          min-height: 0;
          height: 100%;
          max-height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-right: 4px;
          padding-bottom: 24px;
          scrollbar-gutter: stable;
        }

        /* ── HEADER ── */
        .fw-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
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
        .fw-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .fw-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
        .fw-refresh-btn {
          margin-left: auto;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .fw-refresh-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

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
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .fw-upload-panel, .fw-files-panel {
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── DROP ZONE ── */
        .fw-dropzone {
          border: 2px dashed var(--border-medium);
          border-radius: 14px;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          background: var(--bg-surface);
          transition: all 0.22s ease;
          cursor: pointer;
          position: relative;
        }
        .fw-dropzone-dragging {
          border-color: #22d3ee !important;
          background: rgba(34,211,238,0.06) !important;
          box-shadow: 0 0 24px rgba(34,211,238,0.25), inset 0 0 20px rgba(34,211,238,0.1) !important;
          transform: scale(1.012) translateY(-1px);
        }
        .fw-dropzone-ready {
          border-color: #10b981 !important;
          background: rgba(16,185,129,0.03) !important;
          box-shadow: 0 0 16px rgba(16,185,129,0.15) !important;
        }
        .fw-dropzone-icon {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .fw-dropzone-text {
          font-size: 15px;
          color: var(--text-secondary);
        }
        .fw-dropzone-link {
          color: #22d3ee;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .fw-dropzone-hint {
          font-size: 13px;
          color: var(--text-muted);
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
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          word-break: break-all;
          text-align: center;
        }
        .fw-file-preview-size {
          font-size: 13px;
          color: var(--text-secondary);
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
          background: var(--bg-surface);
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
          font-size: 13px;
          color: #22d3ee;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          min-width: 60px;
          text-align: right;
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
          font-size: 15px;
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
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .fw-format-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
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
          font-size: 13px;
          color: var(--text-secondary);
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
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
          border: 1px dashed var(--border-light);
          border-radius: 12px;
          background: var(--bg-surface);
        }
        .fw-files-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fw-files-empty-text { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
        .fw-files-empty-sub { font-size: 13px; color: var(--text-muted); }

        .fw-files-list { display: flex; flex-direction: column; gap: 8px; }
        .fw-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          transition: all 0.15s ease;
        }
        .fw-file-item:hover {
          background: var(--bg-hover);
          border-color: var(--border-medium);
        }
        .file-glow-pdf:hover {
          border-color: rgba(239, 68, 68, 0.35) !important;
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.06) !important;
        }
        .file-glow-csv:hover {
          border-color: rgba(16, 185, 129, 0.35) !important;
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.06) !important;
        }
        .file-glow-json:hover {
          border-color: rgba(245, 158, 11, 0.35) !important;
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.06) !important;
        }
        .file-glow-txt:hover, .file-glow-md:hover {
          border-color: rgba(168, 85, 247, 0.35) !important;
          box-shadow: 0 6px 20px rgba(168, 85, 247, 0.06) !important;
        }
        .fw-file-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fw-file-info { flex: 1; min-width: 0; }
        .fw-file-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fw-file-meta { display: flex; align-items: center; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
        .fw-file-ext-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: 1px solid var(--border-light);
          letter-spacing: 0.5px;
        }
        .fw-file-size { font-size: 12px; color: var(--text-secondary); }
        
        .fw-file-rag-badge {
          display: flex;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(34,211,238,0.12);
          color: #22d3ee;
          border: 1px solid rgba(34,211,238,0.25);
        }
        .fw-file-rag-badge-pending {
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: 1px solid var(--border-light);
        }

        .fw-file-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .fw-file-action-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          padding: 0;
        }
        .fw-file-action-btn:hover { background: rgba(34,211,238,0.12); border-color: rgba(34,211,238,0.3); color: #22d3ee; }
        .fw-delete-btn:hover {
          background: rgba(239,68,68,0.15) !important;
          border-color: rgba(239,68,68,0.3) !important;
          color: #ef4444 !important;
        }
        .fw-analyze-btn {
          width: auto !important;
          display: flex;
          align-items: center;
          padding: 0 10px !important;
          gap: 4px;
          background: rgba(34,211,238,0.06) !important;
          border-color: rgba(34,211,238,0.2) !important;
          color: #22d3ee !important;
          border-radius: 8px !important;
          height: 30px;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .fw-analyze-btn:hover {
          background: rgba(34,211,238,0.18) !important;
          border-color: rgba(34,211,238,0.4) !important;
          color: #67e8f9 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(34,211,238,0.15);
        }
        .fw-reindex-btn {
          width: auto !important;
          display: flex;
          align-items: center;
          padding: 0 10px !important;
          gap: 4px;
          background: rgba(251,191,36,0.06) !important;
          border-color: rgba(251,191,36,0.25) !important;
          color: #fbbf24 !important;
          border-radius: 8px !important;
          height: 30px;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .fw-reindex-btn:hover:not(:disabled) {
          background: rgba(251,191,36,0.15) !important;
          border-color: rgba(251,191,36,0.4) !important;
          color: #fde68a !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(251,191,36,0.15);
        }
        .fw-reindex-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

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
        .fw-ai-hint-title { font-size: 13px; font-weight: 700; color: #67e8f9; }
        .fw-ai-hint-sub { font-size: 10px; color: var(--text-secondary); line-height: 1.5; }

        @media (max-width: 768px) {
          .fw-root {
            padding-bottom: 96px !important;
          }
          .fw-header {
            padding: 12px 14px;
            gap: 10px;
            border-radius: 12px;
          }
          .fw-header-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
          }
          .fw-title { font-size: 15px; }
          .fw-subtitle { font-size: 11px; }
          .fw-upload-panel, .fw-files-panel {
            padding: 14px;
            border-radius: 14px;
          }
          .fw-dropzone {
            padding: 22px 14px;
          }
          .fw-file-item {
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px 12px;
          }
          .fw-file-info {
            flex: 1;
            min-width: 0;
            max-width: calc(100% - 50px);
          }
          .fw-file-name {
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .fw-file-meta {
            gap: 5px;
            flex-wrap: wrap;
          }
          .fw-file-actions {
            width: 100%;
            justify-content: flex-end;
            gap: 6px;
            border-top: 1px solid var(--border-light);
            padding-top: 8px;
            margin-top: 2px;
          }
          .fw-analyze-btn {
            flex: 1;
            justify-content: center;
            max-width: 120px;
          }
          .fw-file-rag-badge, .fw-file-rag-badge-pending {
            font-size: 10px;
            padding: 1px 5px;
          }
          .fw-format-badges {
            gap: 5px;
          }
          .fw-format-badge {
            font-size: 10px;
            padding: 3px 7px;
          }
          .fw-ai-hint {
            padding: 10px 12px;
          }
          .fw-ai-hint-sub {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
    </>
  );
}
