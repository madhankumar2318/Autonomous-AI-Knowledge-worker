"use client";
/**
 * ArtifactCanvas.tsx
 *
 * Dedicated right-pane canvas for displaying, editing and exporting
 * AI-generated deliverables (reports, code, tables, documents).
 *
 * Features:
 *  - Three view modes: Preview (rich markdown), Raw (plain text), Edit (textarea)
 *  - 1-click export: Copy | Download file (.md / .py / .ts / .sql) | PDF print
 *  - Fullscreen overlay toggle
 *  - Live word / line / char stats in footer
 */
import {
  Copy,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  Code2,
  Edit3,
  Eye,
  X,
} from "lucide-react";
import React, { useState, useCallback, useEffect } from "react";
import { formatMessage } from "./chatFormatters";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ArtifactType = "markdown" | "code" | "table" | "html";

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string; // for code type: "python" | "typescript" | "sql" | etc.
  content: string;
}

interface ArtifactCanvasProps {
  artifact: Artifact;
  onClose: () => void;
}

// ── Type Config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ArtifactType, { label: string; color: string; emoji: string }> = {
  markdown: { label: "REPORT",   color: "#22d3ee", emoji: "📄" },
  code:     { label: "CODE",     color: "#a78bfa", emoji: "💻" },
  table:    { label: "TABLE",    color: "#10b981", emoji: "📊" },
  html:     { label: "HTML",     color: "#f59e0b", emoji: "🌐" },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ArtifactCanvas({ artifact, onClose }: ArtifactCanvasProps) {
  const [viewMode, setViewMode] = useState<"preview" | "raw" | "edit">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editContent, setEditContent] = useState(artifact.content);
  const [copyLabel, setCopyLabel] = useState("Copy");

  // Sync when artifact changes (new artifact opened)
  useEffect(() => {
    setEditContent(artifact.content);
    setViewMode("preview");
    setIsFullscreen(false);
  }, [artifact.id]);

  // The content to display/export (may be user-edited in edit mode)
  const displayContent = viewMode === "edit" ? editContent : artifact.content;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayContent);
    setCopyLabel("✓ Copied");
    setTimeout(() => setCopyLabel("Copy"), 1600);
  }, [displayContent]);

  const handleDownload = useCallback(() => {
    let ext = ".md";
    let mime = "text/markdown";
    if (artifact.type === "code") {
      const lang = artifact.language || "";
      if (lang === "python")     { ext = ".py";  mime = "text/x-python"; }
      else if (lang === "typescript" || lang === "tsx") { ext = ".ts"; mime = "text/typescript"; }
      else if (lang === "javascript" || lang === "jsx") { ext = ".js"; mime = "text/javascript"; }
      else if (lang === "sql")   { ext = ".sql"; mime = "text/plain"; }
      else if (lang === "html")  { ext = ".html"; mime = "text/html"; }
      else if (lang === "css")   { ext = ".css";  mime = "text/css"; }
      else                        { ext = ".txt";  mime = "text/plain"; }
    }
    const safe = artifact.title.replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const blob = new Blob([displayContent], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: safe + ext });
    a.click();
    URL.revokeObjectURL(url);
  }, [artifact, displayContent]);

  const handlePDF = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    const escaped = displayContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${artifact.title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           max-width: 820px; margin: 48px auto; padding: 24px 32px;
           color: #1e293b; line-height: 1.7; font-size: 15px; }
    h1 { font-size: 1.9em; color: #0f172a; border-bottom: 2px solid #e2e8f0;
         padding-bottom: 12px; margin-bottom: 20px; }
    h2 { font-size: 1.4em; color: #1e293b; margin-top: 28px; border-left: 3px solid #0ea5e9; padding-left: 10px; }
    h3 { font-size: 1.15em; color: #334155; margin-top: 20px; }
    h4 { font-size: 1em; color: #475569; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
    th { background: #f0f9ff; padding: 10px 14px; text-align: left;
         font-weight: 700; border: 1px solid #cbd5e1; color: #0369a1; }
    td { padding: 8px 14px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
           font-family: 'Courier New', monospace; font-size: 0.88em; color: #0369a1; }
    pre  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
           padding: 16px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
    pre code { background: none; color: #1e293b; padding: 0; }
    blockquote { border-left: 4px solid #cbd5e1; margin: 16px 0;
                 padding: 8px 16px; color: #475569; background: #f8fafc; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${artifact.title}</h1>
  <pre style="white-space: pre-wrap;">${escaped}</pre>
</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }, [artifact, displayContent]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const typeInfo = TYPE_CONFIG[artifact.type] || TYPE_CONFIG.markdown;
  const langLabel = artifact.type === "code" && artifact.language
    ? artifact.language.toUpperCase()
    : typeInfo.label;

  const words = displayContent.trim().split(/\s+/).filter(Boolean).length;
  const lines = displayContent.split("\n").length;
  const chars = displayContent.length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={`artifact-canvas-root${isFullscreen ? " artifact-canvas-fullscreen" : ""}`}>

      {/* ── Header ── */}
      <div className="artifact-canvas-header">
        <div className="artifact-canvas-title-group">
          <span
            className="artifact-type-badge"
            style={{
              background: `${typeInfo.color}18`,
              border: `1px solid ${typeInfo.color}40`,
              color: typeInfo.color,
            }}
          >
            {typeInfo.emoji} {langLabel}
          </span>
          <span className="artifact-canvas-title" title={artifact.title}>
            {artifact.title}
          </span>
        </div>

        {/* View switcher */}
        <div className="artifact-view-switcher">
          {(["preview", "raw", "edit"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`artifact-view-btn${viewMode === mode ? " artifact-view-btn--active" : ""}`}
              onClick={() => setViewMode(mode)}
              title={
                mode === "preview" ? "Rich markdown preview"
                  : mode === "raw" ? "Plain text / raw content"
                  : "Edit content"
              }
            >
              {mode === "preview" ? <Eye size={11} /> : mode === "raw" ? <Code2 size={11} /> : <Edit3 size={11} />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Action toolbar */}
        <div className="artifact-canvas-actions">
          <button type="button" onClick={handleCopy} className="artifact-action-btn" title="Copy full content">
            <Copy size={12} />
            <span>{copyLabel}</span>
          </button>
          <button type="button" onClick={handleDownload} className="artifact-action-btn" title="Download as file">
            <Download size={12} />
            <span>Download</span>
          </button>
          <button type="button" onClick={handlePDF} className="artifact-action-btn" title="Open print / PDF dialog">
            <FileText size={12} />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="artifact-action-btn"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button type="button" onClick={onClose} className="artifact-action-btn artifact-close-btn" title="Close canvas">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="artifact-canvas-body">
        {viewMode === "edit" ? (
          <textarea
            className="artifact-edit-area"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
            aria-label="Edit document content"
          />
        ) : viewMode === "raw" ? (
          <pre className="artifact-raw-view">
            <code>{displayContent}</code>
          </pre>
        ) : (
          <div className="artifact-preview-view">
            {formatMessage(displayContent, () => {})}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="artifact-canvas-footer">
        <span className="artifact-stat">{words.toLocaleString()} words</span>
        <span className="artifact-stat-sep">·</span>
        <span className="artifact-stat">{lines.toLocaleString()} lines</span>
        <span className="artifact-stat-sep">·</span>
        <span className="artifact-stat">{chars.toLocaleString()} chars</span>
        {viewMode === "edit" && (
          <span className="artifact-edit-badge">✎ Editing</span>
        )}
      </div>
    </div>
  );
}
