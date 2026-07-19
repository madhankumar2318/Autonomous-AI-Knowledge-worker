"use client";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FolderOpen,
  Newspaper,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useState } from "react";

// ── Shared Types ─────────────────────────────────────────────────────────────
export interface ToolLog {
  id: string;
  name: string;
  arguments?: string;
  status: "executing" | "success" | "error";
  output?: string;
}

interface ThinkingLogsAccordionProps {
  logs: string[];
  toolLogs?: ToolLog[];
  isGenerating?: boolean;
}

// ── Helper: icon for each known tool name ────────────────────────────────────
function getToolIcon(name: string) {
  switch (name) {
    case "search_knowledge_base":
    case "read_uploaded_file":
      return <FolderOpen size={13} style={{ color: "#c084fc" }} />;
    case "get_latest_news":
      return <Newspaper size={13} style={{ color: "#fbbf24" }} />;
    case "get_stock_price":
    case "get_stock_chart":
      return <TrendingUp size={13} style={{ color: "#10b981" }} />;
    case "web_search":
      return <Search size={13} style={{ color: "#3b82f6" }} />;
    default:
      return <Cpu size={13} style={{ color: "#a1a1aa" }} />;
  }
}

// ── Helper: human-readable label for each tool ───────────────────────────────
function getFriendlyToolName(name: string): string {
  switch (name) {
    case "search_knowledge_base":
      return "Search Knowledge Base";
    case "read_uploaded_file":
      return "Read Document File";
    case "get_latest_news":
      return "Fetch Market News";
    case "get_stock_price":
      return "Retrieve Stock Price";
    case "web_search":
      return "Search Web";
    case "generate_pdf_report":
      return "Generate PDF Report";
    default:
      return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ThinkingLogsAccordion({
  logs,
  toolLogs = [],
  isGenerating,
}: ThinkingLogsAccordionProps) {
  const [isOpen, setIsOpen] = useState(isGenerating ?? false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // Auto-open while generating so the user sees live tool activity
  useEffect(() => {
    if (isGenerating) setIsOpen(true);
  }, [logs.length, toolLogs.length, isGenerating]);

  const toggleStep = (id: string) =>
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));

  const hasStructuredLogs = toolLogs && toolLogs.length > 0;
  const totalSteps = hasStructuredLogs ? toolLogs.length : logs.length;

  return (
    <div
      style={{
        marginBottom: "10px",
        background: "rgba(34, 211, 238, 0.015)",
        border: "1px solid rgba(34, 211, 238, 0.08)",
        borderRadius: "10px",
        overflow: "hidden",
        fontSize: "11px",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.2)",
      }}
    >
      <style>{`
        @keyframes agent-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-light {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .tool-log-item { transition: background-color 0.2s ease; }
        .tool-log-item:hover { background-color: rgba(34, 211, 238, 0.02); }
        .tool-code-block {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 6px 8px;
          border-radius: 6px;
          color: #a5f3fc;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 4px 0;
          font-size: 10px;
        }
      `}</style>

      {/* ── Accordion header / toggle ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(34, 211, 238, 0.03)",
          border: "none",
          cursor: "pointer",
          color: "rgba(103, 232, 249, 0.95)",
          fontWeight: 600,
          textAlign: "left",
          fontFamily: "inherit",
          outline: "none",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings
            size={13}
            style={{
              animation: isGenerating ? "agent-spin 3s linear infinite" : "none",
              color: "#22d3ee",
            }}
          />
          {isGenerating
            ? "Agent executing tools..."
            : `Agent Execution Audit (${totalSteps} step${totalSteps > 1 ? "s" : ""})`}
        </span>
        <span
          style={{
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            fontSize: "9px",
            color: "rgba(103, 232, 249, 0.55)",
          }}
        >
          ▶
        </span>
      </button>

      {/* ── Expandable body ── */}
      {isOpen && (
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            borderTop: "1px solid rgba(34, 211, 238, 0.05)",
            background: "rgba(8, 8, 20, 0.55)",
            boxSizing: "border-box",
          }}
        >
          {!hasStructuredLogs ? (
            // Simple plaintext thinking logs
            logs.map((log, idx) => (
              <div
                key={idx}
                style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(224, 242, 254, 0.75)" }}
              >
                <span
                  style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 4px #22d3ee", flexShrink: 0 }}
                />
                <span style={{ lineHeight: "1.4", fontFamily: "monospace", color: "#a5f3fc" }}>{log}</span>
              </div>
            ))
          ) : (
            // Structured tool-call logs with expand/collapse per step
            toolLogs.map((tool) => {
              const isStepExpanded = !!expandedSteps[tool.id];
              return (
                <div
                  key={tool.id}
                  className="tool-log-item"
                  style={{ borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.01)", overflow: "hidden" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleStep(tool.id)}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: "inherit", outline: "none" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      {tool.status === "executing" ? (
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#eab308", boxShadow: "0 0 6px #eab308", animation: "pulse-light 1s infinite", flexShrink: 0 }} />
                      ) : tool.status === "success" ? (
                        <CheckCircle2 size={12} style={{ color: "#10b981", flexShrink: 0 }} />
                      ) : (
                        <AlertCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />
                      )}
                      {getToolIcon(tool.name)}
                      <span style={{ fontWeight: 550, color: "rgba(255,255,255,0.85)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {getFriendlyToolName(tool.name)}
                      </span>
                      {tool.status === "executing" && (
                        <span style={{ color: "rgba(234,179,8,0.7)", fontStyle: "italic", fontSize: "10px" }}>(executing...)</span>
                      )}
                    </span>
                    <span style={{ transform: isStepExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", fontSize: "8px", color: "rgba(255,255,255,0.35)", paddingRight: "2px" }}>
                      ▶
                    </span>
                  </button>

                  {/* Expanded detail panel for each tool step */}
                  {isStepExpanded && (
                    <div style={{ padding: "8px", background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {tool.arguments && (
                        <div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: "9px", marginBottom: "2px" }}>ARGUMENTS</div>
                          <pre className="tool-code-block">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(tool.arguments), null, 2); }
                              catch { return tool.arguments; }
                            })()}
                          </pre>
                        </div>
                      )}
                      {tool.output && (
                        <div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: "9px", marginBottom: "2px" }}>RESULT</div>
                          <pre className="tool-code-block" style={{ maxHeight: "120px", overflowY: "auto" }}>{tool.output}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
