/**
 * chatFormatters.tsx
 *
 * Pure utility functions for rendering markdown-style chat message text
 * into React nodes. Extracted from ChatAssistant.tsx to reduce file size
 * and make the formatting logic independently readable and testable.
 */
import { FolderOpen } from "lucide-react";
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
  // Matches **bold**, `code`, [link](url), and [Source: file.ext] (Relevancy: X%)
  const regex =
    /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\[Source:\s*[^\]]+\](?:\s*\(\s*Relevancy:\s*\d+%\s*\))?)/g;
  const parts = lineText.split(regex);

  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ fontWeight: 700, color: "#fff" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            background: "rgba(34,211,238,0.1)",
            padding: "1px 6px",
            borderRadius: "4px",
            color: "#67e8f9",
            fontFamily: "monospace",
            fontSize: "0.85em",
            border: "1px solid rgba(34,211,238,0.2)",
          }}
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
        const filename = match[1].trim();
        const pageNum = match[2] ? parseInt(match[2].trim(), 10) : undefined;
        const relevancy = match[3] ? match[3].trim() : null;
        const phrase = getPrecedingPhrase(lineText, lineText.indexOf(part));
        return (
          <button
            key={index}
            type="button"
            onClick={() => onCitationClick(filename, phrase, pageNum)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              color: "#f59e0b",
              borderRadius: "5px",
              padding: "1px 5px",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer",
              margin: "0 3px",
              verticalAlign: "middle",
              transition: "all 0.15s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(245, 158, 11, 0.16)";
              e.currentTarget.style.border = "1px solid rgba(245, 158, 11, 0.4)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(245, 158, 11, 0.08)";
              e.currentTarget.style.border = "1px solid rgba(245, 158, 11, 0.25)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <FolderOpen size={10} />
            <span>
              {filename}
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
    }

    // Markdown link: [label](url)
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#22d3ee", textDecoration: "underline", fontWeight: 600 }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

// ── Main: convert full message text to an array of React nodes ────────────────
export function formatMessage(
  text: string,
  onCitationClick: CitationClickHandler
): React.ReactNode[] {
  if (!text) return [];

  const segments: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeBlockLanguage = "";
  let codeBlockLines: string[] = [];

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

  const pushCodeBlock = (codeText: string) => {
    const btnId = `copy-btn-${segments.length}`;
    const capturedCode = codeText;
    segments.push(
      <div
        key={`code-${segments.length}`}
        style={{
          background: "#0b0f19",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          margin: "12px 0",
          fontFamily: "monospace",
          fontSize: "0.85em",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Code block header bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#060913",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            padding: "4px 12px",
            height: "28px",
          }}
        >
          <span style={{ color: "#475569", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>
            {codeBlockLanguage || "code"}
          </span>
          <button
            id={btnId}
            type="button"
            onClick={() => handleCopy(capturedCode, btnId)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: "#94a3b8",
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Copy
          </button>
        </div>
        <pre style={{ margin: 0, padding: "12px", overflowX: "auto", color: "#e2e8f0", lineHeight: "1.5" }}>
          <code>{codeText}</code>
        </pre>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // Close the code block
        pushCodeBlock(codeBlockLines.join("\n"));
        codeBlockLines = [];
        codeBlockLanguage = "";
        inCodeBlock = false;
      } else {
        // Open a new code block
        inCodeBlock = true;
        codeBlockLanguage = line.trim().slice(3).trim();
      }
    } else if (inCodeBlock) {
      codeBlockLines.push(line);
    } else {
      // Normal text line — check for bullet points
      const isBullet =
        line.trim().startsWith("- ") ||
        line.trim().startsWith("* ") ||
        line.trim().startsWith("• ");

      if (isBullet) {
        const cleanLine = line.trim().replace(/^[-*•]\s+/, "");
        segments.push(
          <div key={`line-${i}`} style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
            <span style={{ color: "#22d3ee", flexShrink: 0, lineHeight: "1.6" }}>▸</span>
            <span>{parseInlineStyles(cleanLine, onCitationClick)}</span>
          </div>
        );
      } else {
        segments.push(
          <div key={`line-${i}`} className={line.trim() === "" ? "" : "chat-line"}>
            {parseInlineStyles(line, onCitationClick)}
          </div>
        );
      }
    }
  }

  // Flush any open code block that was still streaming when the component rendered
  if (inCodeBlock && codeBlockLines.length > 0) {
    pushCodeBlock(codeBlockLines.join("\n"));
  }

  return segments;
}
