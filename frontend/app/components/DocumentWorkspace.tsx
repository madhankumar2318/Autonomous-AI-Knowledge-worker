"use client";
import {
  X,
  FileText,
  FileJson,
  File,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Brain,
  Edit3,
  Save,
  Undo,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import ChatAssistant from "./ChatAssistant";
import { showToast } from "./Toast";
import { API_BASE_URL } from "../config";

interface UploadedFile {
  id: string | number;
  filename: string;
  size: number;
  rag_indexed?: boolean;
  chunks?: number;
}

interface DocumentWorkspaceProps {
  file: UploadedFile;
  username: string;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = getFileExt(filename);
  if (ext === "json") return <FileJson className="w-4 h-4" style={{ color: "#fbbf24" }} />;
  if (ext === "pdf")  return <FileText className="w-4 h-4" style={{ color: "#f87171" }} />;
  if (ext === "csv")  return <FileText className="w-4 h-4" style={{ color: "#34d399" }} />;
  if (ext === "md")   return <FileText className="w-4 h-4" style={{ color: "#c084fc" }} />;
  return <File className="w-4 h-4" style={{ color: "#94a3b8" }} />;
}

export default function DocumentWorkspace({
  file,
  username,
  onClose,
}: DocumentWorkspaceProps) {
  const ext = getFileExt(file.filename);
  const isPDF = ext === "pdf";
  const fileUrl = `${API_BASE_URL}/upload/download/${encodeURIComponent(file.filename)}`;

  // For text-based files: fetch and display content
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [pdfZoom, setPdfZoom] = useState(100);

  // Edit mode states (for text, JSON, CSV, MD files)
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isPDF) return;
    setTextLoading(true);
    setTextError(null);
    fetch(fileUrl, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load file (${r.status})`);
        return r.text();
      })
      .then((txt) => {
        setTextContent(txt);
        setEditedContent(txt);
      })
      .catch((err) => setTextError(String(err)))
      .finally(() => setTextLoading(false));
  }, [fileUrl, isPDF]);


  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const handleSave = async () => {
    if (editedContent === textContent) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/upload/edit/${encodeURIComponent(file.filename)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to save file updates.");
      }
      setTextContent(editedContent);
      setIsEditing(false);
      showToast("success", `File saved! Re-indexed into RAG with ${data.chunks} chunks.`);
    } catch (err) {
      showToast("error", String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(textContent || "");
    setIsEditing(false);
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);


  return (
    <div className="dw-overlay">
      <style>{`
        /* ── Document Workspace Overlay ── */
        .dw-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: var(--bg-main, #0f1117);
          animation: dwFadeIn 0.22s ease-out;
        }
        /* Hide global floating chat button when workspace is active */
        .chat-floating-wrapper {
          display: none !important;
        }
        @keyframes dwFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ── Top Bar ── */
        .dw-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: var(--bg-card, rgba(255,255,255,0.03));
          border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.08));
          flex-shrink: 0;
          height: 54px;
        }
        .dw-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary, #94a3b8);
          background: transparent;
          border: 1px solid var(--border-light, rgba(255,255,255,0.08));
          border-radius: 8px;
          padding: 5px 12px;
          cursor: pointer;
          transition: all 0.18s ease;
          flex-shrink: 0;
        }
        .dw-back-btn:hover {
          color: var(--text-primary, #f1f5f9);
          background: var(--bg-hover, rgba(255,255,255,0.06));
        }
        .dw-file-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .dw-file-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dw-file-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .dw-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.6px;
          padding: 2px 7px;
          border-radius: 5px;
          border: 1px solid;
          text-transform: uppercase;
        }
        .dw-badge-ext {
          color: #22d3ee;
          border-color: rgba(34,211,238,0.3);
          background: rgba(34,211,238,0.08);
        }
        .dw-badge-rag {
          color: #34d399;
          border-color: rgba(52,211,153,0.3);
          background: rgba(52,211,153,0.08);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .dw-file-size {
          font-size: 12px;
          color: var(--text-muted, #64748b);
          flex-shrink: 0;
        }

        /* ── Split Body ── */
        .dw-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        /* ── Left: Document Viewer ── */
        .dw-viewer {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-light, rgba(255,255,255,0.08));
          overflow: hidden;
          min-width: 0;
        }
        .dw-viewer-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: var(--bg-card, rgba(255,255,255,0.02));
          border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.06));
          flex-shrink: 0;
        }
        .dw-viewer-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text-muted, #64748b);
        }
        .dw-zoom-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dw-zoom-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border-light, rgba(255,255,255,0.08));
          background: transparent;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .dw-zoom-btn:hover {
          background: var(--bg-hover, rgba(255,255,255,0.06));
          color: var(--text-primary, #f1f5f9);
        }
        .dw-zoom-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary, #94a3b8);
          min-width: 36px;
          text-align: center;
        }
        .dw-viewer-content {
          flex: 1;
          overflow: auto;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--bg-main, #0f1117);
        }

        /* PDF iframe */
        .dw-pdf-frame {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          transform-origin: top center;
        }

        /* Text viewer */
        .dw-text-content {
          width: 100%;
          height: 100%;
          overflow: auto;
          padding: 20px 24px;
        }
        .dw-text-pre {
          font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-primary, #e2e8f0);
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
          counter-reset: line;
        }
        .dw-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          gap: 12px;
          color: var(--text-muted, #64748b);
          font-size: 13px;
        }
        .dw-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.08);
          border-top-color: #22d3ee;
          border-radius: 50%;
          animation: dwSpin 0.8s linear infinite;
        }
        @keyframes dwSpin { to { transform: rotate(360deg); } }

        .dw-error {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: #f87171;
          font-size: 13px;
          padding: 24px;
          text-align: center;
        }

        /* ── Right: Chat Panel ── */
        .dw-chat-panel {
          width: 420px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-main, #0f1117);
        }
        .dw-chat-header {
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.06));
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          background: rgba(34, 211, 238, 0.04);
        }
        .dw-chat-header-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(34,211,238,0.12);
          border: 1px solid rgba(34,211,238,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dw-chat-header-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .dw-chat-header-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary, #f1f5f9);
        }
        .dw-chat-header-sub {
          font-size: 10px;
          color: var(--text-muted, #64748b);
        }
        .dw-chat-inner {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        /* ── Textarea Edit Mode ── */
        .dw-text-textarea {
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          background: rgba(0, 0, 0, 0.15);
          color: var(--text-primary, #e2e8f0);
          font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.7;
          padding: 20px 24px;
          resize: none;
          border-radius: 0;
        }

        .dw-edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #22d3ee;
          background: rgba(34,211,238,0.06);
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dw-edit-btn:hover:not(:disabled) {
          background: rgba(34,211,238,0.15);
          border-color: rgba(34,211,238,0.35);
          color: #67e8f9;
        }
        .dw-save-btn {
          color: #34d399;
          background: rgba(52,211,153,0.06);
          border-color: rgba(52,211,153,0.25);
        }
        .dw-save-btn:hover:not(:disabled) {
          color: #6ee7b7;
          background: rgba(52,211,153,0.18);
          border-color: rgba(52,211,153,0.4);
        }
        .dw-cancel-btn {
          color: #94a3b8;
          background: rgba(148,163,184,0.06);
          border-color: rgba(148,163,184,0.2);
          margin-left: 6px;
        }
        .dw-cancel-btn:hover:not(:disabled) {
          color: #f1f5f9;
          background: rgba(148,163,184,0.15);
          border-color: rgba(148,163,184,0.3);
        }
        .dw-edit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }


        /* Make the inline ChatAssistant fill the right panel completely */
        .dw-chat-inner .chat-inline-root {
          height: 100%;
          border-radius: 0;
          border: none;
          background: transparent;
        }

        @media (max-width: 900px) {
          .dw-body { flex-direction: column; }
          .dw-viewer { border-right: none; border-bottom: 1px solid var(--border-light, rgba(255,255,255,0.08)); min-height: 50vh; }
          .dw-chat-panel { width: 100%; height: 50vh; }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div className="dw-topbar">
        <button className="dw-back-btn" onClick={onClose} title="Close workspace (Esc)">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="dw-file-info">
          <FileTypeIcon filename={file.filename} />
          <span className="dw-file-name" title={file.filename}>{file.filename}</span>
          <div className="dw-file-badges">
            <span className="dw-badge dw-badge-ext">{ext}</span>
            {file.rag_indexed && (
              <span className="dw-badge dw-badge-rag">
                <Brain className="w-3 h-3" />
                RAG · {file.chunks ?? 0} chunks
              </span>
            )}
          </div>
          <span className="dw-file-size">{formatSize(file.size)}</span>
        </div>

        <button className="dw-back-btn" onClick={onClose} title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Split Body ── */}
      <div className="dw-body">
        {/* Left: Document Viewer */}
        <div className="dw-viewer">
          <div className="dw-viewer-toolbar">
            <span className="dw-viewer-label">
              {isEditing ? "📝 Editing Document" : "📄 Document Preview"}
            </span>

            {/* Render zoom for PDF, or Edit/Save controls for text-based files */}
            {isPDF ? (
              <div className="dw-zoom-controls">
                <button
                  className="dw-zoom-btn"
                  onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="dw-zoom-label">{pdfZoom}%</span>
                <button
                  className="dw-zoom-btn"
                  onClick={() => setPdfZoom((z) => Math.min(200, z + 10))}
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  className="dw-zoom-btn"
                  onClick={() => setPdfZoom(100)}
                  title="Reset zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              !textLoading && !textError && textContent !== null && (
                <div className="dw-zoom-controls">
                  {isEditing ? (
                    <>
                      <button
                        className="dw-edit-btn dw-save-btn"
                        onClick={handleSave}
                        disabled={saving}
                        title="Save changes and re-index"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="dw-edit-btn dw-cancel-btn"
                        onClick={handleCancel}
                        disabled={saving}
                        title="Cancel edits"
                      >
                        <Undo className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="dw-edit-btn"
                      onClick={() => setIsEditing(true)}
                      title="Edit file content"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Content
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          <div className="dw-viewer-content">
            {isPDF ? (
              <iframe
                className="dw-pdf-frame"
                src={fileUrl}
                title={file.filename}
                style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: "top center", height: pdfZoom === 100 ? "100%" : `${10000 / pdfZoom}%` }}
              />
            ) : textLoading ? (
              <div className="dw-loading">
                <div className="dw-spinner" />
                <span>Loading document…</span>
              </div>
            ) : textError ? (
              <div className="dw-error">⚠️ {textError}</div>
            ) : isEditing ? (
              <textarea
                className="dw-text-textarea"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                disabled={saving}
                placeholder="Type your edits here..."
              />
            ) : (
              <div className="dw-text-content">
                <pre className="dw-text-pre">{textContent}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div className="dw-chat-panel">
          <div className="dw-chat-header">
            <div className="dw-chat-header-icon">
              <Brain className="w-4 h-4" style={{ color: "#22d3ee" }} />
            </div>
            <div className="dw-chat-header-text">
              <span className="dw-chat-header-title">Document AI Chat</span>
              <span className="dw-chat-header-sub">Answers pulled exclusively from this file</span>
            </div>
          </div>
          <div className="dw-chat-inner">
            <ChatAssistant
              username={username}
              inline={true}
              activeDocumentFilename={file.filename}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
