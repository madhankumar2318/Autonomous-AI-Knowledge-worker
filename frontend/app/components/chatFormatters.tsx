/**
 * chatFormatters.tsx
 *
 * Production-grade Markdown rendering engine for AI chat messages.
 * Supports: Headings (H1–H4), Tables, Ordered & Unordered Lists,
 *           Code Blocks (with copy), Inline Code, Bold, Italic,
 *           Strikethrough, Horizontal Rules, Links (URL whitelist),
 *           and RAG Citation Badges.
 *
 * Extracted from ChatAssistant.tsx for independent readability and testability.
 */
import { FolderOpen, Newspaper } from "lucide-react";
import React from "react";

// ── Citation click handler type ───────────────────────────────────────────────
export type CitationClickHandler = (
  filename: string,
  phrase: string,
  pageNum?: number
) => void;

// ── Helper: extract the sentence immediately before a citation ────────────────
export function getPrecedingPhrase(fullText: string, citationIndex: number): string {
  const precedingText = fullText.slice(0, citationIndex).trim();
  const sentences = precedingText.split(/[.\n?•▸]/);
  const lastSentence = sentences[sentences.length - 1].trim();
  if (lastSentence.length < 12 && sentences.length > 1) {
    return (sentences[sentences.length - 2].trim() + " " + lastSentence).trim().slice(-100);
  }
  return lastSentence.slice(-100);
}

// ── Helper: parse inline markdown tokens within a single line ─────────────────
export function parseInlineStyles(
  lineText: string,
  onCitationClick: CitationClickHandler
): React.ReactNode[] {
  // Matches: **bold**, ~~strike~~, *italic*, _italic_, `code`, [link](url), [Source: ...]
  const regex =
    /(\*\*.*?\*\*|~~.*?~~|\*(?!\*).*?\*(?!\*)|_(?!_).*?_(?!_)|`.*?`|\[.*?\]\(.*?\)|\[Source:\s*[^\]]+\](?:\s*\(\s*Relevancy:\s*\d+%\s*\))?)/g;
  const parts = lineText.split(regex);

  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
      return (
        <s key={index} style={{ opacity: 0.6 }}>
          {part.slice(2, -2)}
        </s>
      );
    }

    // Italic: *text* or _text_ (but not **bold** or __double__)
    if (
      ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))) &&
      part.length > 2 &&
      !part.startsWith("**")
    ) {
      return (
        <em key={index} style={{ fontStyle: "italic", opacity: 0.9 }}>
          {part.slice(1, -1)}
        </em>
      );
    }

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          className="chat-md-inline-code"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // RAG citation badge: [Source: filename, Page: N] (Relevancy: X%)
    if (part.startsWith("[Source:") && part.includes("]")) {
      const match = part.match(
        /\[Source:\s*([^,\]]+)(?:,\s*Page:\s*(\d+))?\](?:\s*\(\s*Relevancy:\s*(\d+%)\s*\))?/
      );
      if (match) {
        const sourceName = match[1].trim();
        const pageNum = match[2] ? parseInt(match[2].trim(), 10) : undefined;
        const relevancy = match[3] ? match[3].trim() : null;
        const phrase = getPrecedingPhrase(lineText, lineText.indexOf(part));
        const isDocFile = /\.(pdf|csv|xlsx|docx|txt|json|md)$/i.test(sourceName);

        if (isDocFile) {
          // Document file citation in workspace
          return (
            <button
              key={index}
              type="button"
              onClick={() => onCitationClick(sourceName, phrase, pageNum)}
              className="chat-md-citation"
              title="Click to view passage in Document Workspace"
            >
              <FolderOpen size={10} />
              <span>
                {sourceName}
                {pageNum ? `, Page ${pageNum}` : ""}
              </span>
              {relevancy && (
                <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: "2px" }}>
                  ({relevancy})
                </span>
              )}
            </button>
          );
        }

        // External News / Web Source reference badge (not a workspace document)
        return (
          <span
            key={index}
            className="chat-md-citation chat-md-citation--ref"
            title="External news / data source"
          >
            <Newspaper size={10} />
            <span>{sourceName}</span>
            {relevancy && (
              <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: "2px" }}>
                ({relevancy})
              </span>
            )}
          </span>
        );
      }
    }

    // ── Markdown link: [label](url) ──────────────────────────────────────────
    // SECURITY: Strict protocol whitelist — blocks javascript:, data:, vbscript: etc.
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const label = linkMatch[1];
      const rawUrl = linkMatch[2].trim();
      const isSafeUrl =
        /^https?:\/\//i.test(rawUrl) ||
        /^mailto:/i.test(rawUrl) ||
        /^tel:/i.test(rawUrl);

      if (!isSafeUrl) {
        return (
          <span
            key={index}
            title={`Blocked unsafe URL scheme: "${rawUrl.slice(0, 40)}"`}
            className="chat-md-blocked-link"
          >
            🚫 {label}
          </span>
        );
      }

      return (
        <a
          key={index}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-md-link"
        >
          {label}
        </a>
      );
    }

    return part;
  });
}

// ── Table Parser ─────────────────────────────────────────────────────────────
// Detects a consecutive block of | col | col | rows and returns a styled table.
function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|[\s\-:|]*\|[\s\-:|]*$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1) // remove leading/trailing |
    .split("|")
    .map((cell) => cell.trim());
}

// ── Main: convert full message text to an array of React nodes ────────────────
export function formatMessage(
  text: string,
  onCitationClick: CitationClickHandler
): React.ReactNode[] {
  if (!text) return [];

  // Safety-net: strip any residual <research_plan> tags that weren't consumed by the stream parser
  const sanitized = text.replace(/<research_plan[^>]*>[^<]*<\/research_plan>/g, "").trimStart();

  const segments: React.ReactNode[] = [];
  const lines = sanitized.split("\n");
  let i = 0;

  const handleCopy = (codeText: string, btnId: string) => {
    navigator.clipboard.writeText(codeText);
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.innerText = "Copied!";
      btn.style.background = "rgba(16, 185, 129, 0.25)";
      btn.style.borderColor = "#10b981";
      btn.style.color = "#10b981";
      setTimeout(() => {
        btn.innerText = "Copy";
        btn.style.background = "rgba(255, 255, 255, 0.03)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.1)";
        btn.style.color = "#94a3b8";
      }, 1500);
    }
  };

  const pushCodeBlock = (codeText: string, language: string) => {
    const btnId = `copy-btn-${segments.length}-${Math.random().toString(36).slice(2, 7)}`;
    const capturedCode = codeText;
    segments.push(
      <div key={`code-${segments.length}`} className="chat-md-code-block">
        {/* Code block header */}
        <div className="chat-md-code-header">
          <span className="chat-md-code-lang">
            {language || "code"}
          </span>
          <button
            id={btnId}
            type="button"
            onClick={() => handleCopy(capturedCode, btnId)}
            className="chat-md-code-copy"
          >
            Copy
          </button>
        </div>
        <pre className="chat-md-code-pre">
          <code>{codeText}</code>
        </pre>
      </div>
    );
  };

  const pushTable = (tableLines: string[]) => {
    if (tableLines.length < 2) return;

    const headerCells = parseTableCells(tableLines[0]);
    // Find separator row index
    const sepIdx = tableLines.findIndex((l, idx) => idx > 0 && isSeparatorRow(l));
    if (sepIdx === -1) return; // not a valid table, skip

    const bodyLines = tableLines.slice(sepIdx + 1).filter((l) => isTableRow(l));

    segments.push(
      <div key={`table-${segments.length}`} className="chat-md-table-wrap">
        <table className="chat-md-table">
          <thead>
            <tr>
              {headerCells.map((cell, ci) => (
                <th key={ci}>{parseInlineStyles(cell, onCitationClick)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyLines.map((row, ri) => {
              const cells = parseTableCells(row);
              return (
                <tr key={ri} className={ri % 2 === 0 ? "chat-md-table-row-even" : "chat-md-table-row-odd"}>
                  {cells.map((cell, ci) => (
                    <td key={ci}>{parseInlineStyles(cell, onCitationClick)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Collect ordered list items
  const pushOrderedList = (items: string[]) => {
    segments.push(
      <ol key={`ol-${segments.length}`} className="chat-md-ol">
        {items.map((item, idx) => (
          <li key={idx} className="chat-md-ol-item">
            {parseInlineStyles(item, onCitationClick)}
          </li>
        ))}
      </ol>
    );
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Code Block ────────────────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      // Flush any partial code block still streaming
      pushCodeBlock(codeLines.join("\n"), language);
      i++; // skip closing ```
      continue;
    }

    // ── Markdown Table ────────────────────────────────────────────────────────
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      pushTable(tableLines);
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    if (trimmed.startsWith("#### ")) {
      segments.push(
        <div key={`h4-${i}`} className="chat-md-h4">
          {parseInlineStyles(trimmed.slice(5), onCitationClick)}
        </div>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      segments.push(
        <div key={`h3-${i}`} className="chat-md-h3">
          {parseInlineStyles(trimmed.slice(4), onCitationClick)}
        </div>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      segments.push(
        <div key={`h2-${i}`} className="chat-md-h2">
          {parseInlineStyles(trimmed.slice(3), onCitationClick)}
        </div>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      segments.push(
        <div key={`h1-${i}`} className="chat-md-h1">
          {parseInlineStyles(trimmed.slice(2), onCitationClick)}
        </div>
      );
      i++;
      continue;
    }

    // ── Horizontal Rule ───────────────────────────────────────────────────────
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      segments.push(<hr key={`hr-${i}`} className="chat-md-hr" />);
      i++;
      continue;
    }

    // ── Ordered List ──────────────────────────────────────────────────────────
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      pushOrderedList(items);
      continue;
    }

    // ── Unordered Bullet List ─────────────────────────────────────────────────
    if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("• ")
    ) {
      const cleanLine = trimmed.replace(/^[-*•]\s+/, "");
      segments.push(
        <div key={`bullet-${i}`} className="chat-md-bullet">
          <span className="chat-md-bullet-dot">▸</span>
          <span>{parseInlineStyles(cleanLine, onCitationClick)}</span>
        </div>
      );
      i++;
      continue;
    }

    // ── Normal text line ──────────────────────────────────────────────────────
    segments.push(
      <div
        key={`line-${i}`}
        className={trimmed === "" ? "chat-md-spacer" : "chat-md-line"}
      >
        {trimmed === "" ? null : parseInlineStyles(line, onCitationClick)}
      </div>
    );
    i++;
  }

  return segments;
}
