"use client";
import {
  Bot,
  Clock,
  Download,
  History,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  User,
  X,
  Zap,
  Settings,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";
import { API_BASE_URL } from "../config";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  thinkingLogs?: string[];
}

interface ChatThread {
  id: string;
  username: string;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatAssistantProps {
  username?: string;
  inline?: boolean;
  activeDocumentFilename?: string | null;
}

interface ThinkingLogsAccordionProps {
  logs: string[];
  isGenerating?: boolean;
}

function ThinkingLogsAccordion({ logs, isGenerating }: ThinkingLogsAccordionProps) {
  const [isOpen, setIsOpen] = useState(isGenerating ?? false);

  useEffect(() => {
    if (isGenerating) {
      setIsOpen(true);
    }
  }, [logs.length, isGenerating]);

  return (
    <div className="chat-thinking-accordion" style={{
      marginBottom: "8px",
      background: "rgba(34, 211, 238, 0.02)",
      border: "1px solid rgba(34, 211, 238, 0.12)",
      borderRadius: "8px",
      overflow: "hidden",
      fontSize: "11px",
      width: "100%",
      boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes agent-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          background: "rgba(34, 211, 238, 0.04)",
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
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Settings
            size={12}
            style={{
              animation: isGenerating ? "agent-spin 2s linear infinite" : "none",
              color: "#22d3ee",
            }}
          />
          {isGenerating ? "Agent executing tools..." : `Tool execution audit (${logs.length} step${logs.length > 1 ? "s" : ""})`}
        </span>
        <span style={{
          transition: "transform 0.2s ease",
          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          fontSize: "9px",
          color: "rgba(103, 232, 249, 0.65)",
        }}>
          ▶
        </span>
      </button>
      {isOpen && (
        <div style={{
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          borderTop: "1px solid rgba(34, 211, 238, 0.08)",
          background: "rgba(8, 8, 20, 0.4)",
          boxSizing: "border-box",
        }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(224, 242, 254, 0.75)",
            }}>
              <span style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "#22d3ee",
                boxShadow: "0 0 4px #22d3ee",
                flexShrink: 0
              }} />
              <span style={{
                lineHeight: "1.4",
                fontFamily: "monospace",
                color: "#a5f3fc"
              }}>
                {log}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_PROMPTS = [
  "📊 Summarize today's top news",
  "📈 What are the best performing stocks?",
  "🔍 Analyze market sentiment",
  "💡 What should I know today?",
];

export default function ChatAssistant({
  username = "guest",
  inline = false,
  activeDocumentFilename = null,
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ak_selected_model") || "llama-70b";
    }
    return "llama-70b";
  });
  
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (typeof window !== "undefined") {
      localStorage.setItem("ak_selected_model", model);
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content: activeDocumentFilename
        ? `📄 **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document — I'll search it and give you precise, cited answers.`
        : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string>("");

  // ── Thread History State ──
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showThreadSidebar, setShowThreadSidebar] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const welcomeMessage = (): ChatMessage => ({
    role: "ai",
    content: activeDocumentFilename
      ? `📄 **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document — I'll search it and give you precise, cited answers.`
      : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
  });

  // ── Thread CRUD Helpers ──
  const fetchThreads = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads?username=${encodeURIComponent(username)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setThreads(data);
      }
    } catch { /* silent */ }
  };

  const createThread = async (firstMessage?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, title: firstMessage ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "") : "New Chat", model: selectedModel }),
      });
      if (res.ok) {
        const thread = await res.json();
        setThreads((prev) => [thread, ...prev]);
        setActiveThreadId(thread.id);
        return thread.id as string;
      }
    } catch { /* silent */ }
    return null;
  };

  const switchThread = async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads/${threadId}/messages`, { credentials: "include" });
      if (res.ok) {
        const msgs = await res.json();
        if (msgs.length === 0) {
          setMessages([welcomeMessage()]);
        } else {
          setMessages(msgs.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "ai", content: m.content })));
        }
      }
    } catch { setMessages([welcomeMessage()]); }
  };

  const renameThread = async (threadId: string, title: string) => {
    try {
      await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, title } : t));
    } catch { /* silent */ }
    setRenamingThreadId(null);
  };

  const deleteThread = async (threadId: string) => {
    try {
      await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, { method: "DELETE", credentials: "include" });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([welcomeMessage()]);
      }
    } catch { /* silent */ }
  };

  const exportThread = (thread: ChatThread) => {
    let md = `# ${thread.title}\n\n`;
    for (const msg of messages) {
      md += msg.role === "user" ? `**You:** ${msg.content}\n\n` : `**AI:** ${msg.content}\n\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${thread.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startNewChat = async () => {
    setActiveThreadId(null);
    setMessages([welcomeMessage()]);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Load threads on mount
  useEffect(() => {
    fetchThreads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (inline && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inline]);

  const formatMessage = (text: string) => {
    if (!text) return "";
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const isBullet =
        line.trim().startsWith("- ") ||
        line.trim().startsWith("* ") ||
        line.trim().startsWith("• ");
      if (isBullet) {
        const cleanLine = line.trim().replace(/^[-*•]\s+/, "");
        return (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
            <span style={{ color: "#22d3ee", flexShrink: 0, lineHeight: "1.6" }}>▸</span>
            <span>{parseInlineStyles(cleanLine)}</span>
          </div>
        );
      }
      return (
        <div key={i} className={line.trim() === "" ? "" : "chat-line"}>
          {parseInlineStyles(line)}
        </div>
      );
    });
  };

  const parseInlineStyles = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} style={{ fontWeight: 700, color: "#fff" }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} style={{ background: "rgba(34,211,238,0.1)", padding: "1px 6px", borderRadius: "4px", color: "#67e8f9", fontFamily: "monospace", fontSize: "0.85em", border: "1px solid rgba(34,211,238,0.2)" }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee", textDecoration: "underline", fontWeight: 600 }}>
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async (text?: string) => {
    const userMessage = (text ?? input).trim();
    if (!userMessage || loading) return;
    setInput("");
    setStreamingStatus("");

    // Auto-create a thread if none is active
    let threadId = activeThreadId;
    if (!threadId) {
      threadId = await createThread(userMessage);
    }

    // Append user message + empty AI placeholder
    const chatHistory = messages.map((msg) => ({
      role: msg.role === "ai" ? "ai" : "user",
      content: msg.content,
    }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage } as ChatMessage,
      { role: "ai", content: "" } as ChatMessage,
    ]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: userMessage,
          username,
          history: chatHistory,
          model: selectedModel,
          thread_id: threadId,
          ...(activeDocumentFilename ? { filename: activeDocumentFilename } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process all complete SSE lines in the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep the last (possibly incomplete) line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            // Stream complete
            setStreamingStatus("");
            break;
          }

          try {
            const event = JSON.parse(payload) as { type: string; content: string };
            if (event.type === "token") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.content,
                  };
                }
                return updated;
              });
            } else if (event.type === "status") {
              setStreamingStatus(event.content);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  const logs = last.thinkingLogs ? [...last.thinkingLogs] : [];
                  if (!logs.includes(event.content)) {
                    logs.push(event.content);
                  }
                  updated[updated.length - 1] = {
                    ...last,
                    thinkingLogs: logs,
                  };
                }
                return updated;
              });
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: event.content,
                  };
                }
                return updated;
              });
            }
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User stopped generation — finalize the partial message as-is
        setStreamingStatus("");
      } else {
        showToast("error", "Failed to connect to AI server.");
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "ai" && last.content === "") {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, I'm currently offline. Please check if the backend server is running.",
            };
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
      setStreamingStatus("");
      abortControllerRef.current = null;
      // Refresh threads to pick up auto-title and updated_at changes
      fetchThreads();
    }
  };

  // ── INLINE (full-page tab) MODE ──
  if (inline) {
    return (
      <div className="chat-inline-root">
        {/* Header */}
        <div className="chat-inline-header">
          <button
            type="button"
            className="chat-sidebar-toggle"
            onClick={() => setShowThreadSidebar(!showThreadSidebar)}
            title={showThreadSidebar ? "Hide history" : "Show history"}
          >
            {showThreadSidebar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <div className="chat-inline-avatar">
            <Sparkles className="w-4 h-4" style={{ color: "#67e8f9" }} />
          </div>
          <div>
            <div className="chat-inline-title">AI Knowledge Worker</div>
            <div className="chat-inline-status">
              <span className="chat-status-dot" style={{
                background: selectedModel === "llama-70b" ? "#c084fc" : (selectedModel === "gemini-pro" ? "#60a5fa" : "#34d399"),
                boxShadow: selectedModel === "llama-70b" ? "0 0 6px #c084fc" : (selectedModel === "gemini-pro" ? "0 0 6px #60a5fa" : "0 0 6px #34d399")
              }} />
              <span>Online · {selectedModel === "llama-70b" ? "Llama 3.3 70B (Groq)" : (selectedModel === "gemini-pro" ? "Gemini 2.5 Pro" : "Gemini 2.5 Flash")}</span>
            </div>
          </div>
          <div className="chat-header-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="chat-model-select"
            >
              <option value="llama-70b" style={{ background: "#080814", color: "#ffffff" }}>Llama 3.3 (Groq)</option>
              <option value="gemini-pro" style={{ background: "#080814", color: "#ffffff" }}>Gemini Pro</option>
              <option value="gemini-flash" style={{ background: "#080814", color: "#ffffff" }}>Gemini Flash</option>
            </select>
            <button
              type="button"
              onClick={startNewChat}
              className="chat-clear-btn"
              title="New conversation"
            >
              <Plus size={14} />
              New Chat
            </button>
          </div>
        </div>

        {/* Body: Sidebar + Chat */}
        <div className="chat-inline-body">
          {/* Thread Sidebar */}
          {showThreadSidebar && (
            <div className="chat-thread-sidebar">
              <div className="chat-thread-sidebar-header">
                <History size={14} />
                <span>Chat History</span>
                <span className="chat-thread-count">{threads.length}</span>
              </div>
              <div className="chat-thread-list">
                {threads.length === 0 && (
                  <div className="chat-thread-empty">
                    <MessageSquare size={20} style={{ opacity: 0.3 }} />
                    <span>No conversations yet</span>
                  </div>
                )}
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`chat-thread-item ${activeThreadId === thread.id ? "chat-thread-active" : ""}`}
                    onClick={() => switchThread(thread.id)}
                  >
                    {renamingThreadId === thread.id ? (
                      <input
                        type="text"
                        className="chat-thread-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameThread(thread.id, renameValue)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameThread(thread.id, renameValue); if (e.key === "Escape") setRenamingThreadId(null); }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="chat-thread-info">
                          <span className="chat-thread-title">{thread.title}</span>
                          <span className="chat-thread-time">
                            <Clock size={10} />
                            {timeAgo(thread.updated_at)}
                          </span>
                        </div>
                        <div className="chat-thread-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" title="Rename" onClick={() => { setRenamingThreadId(thread.id); setRenameValue(thread.title); }}>
                            <Pencil size={11} />
                          </button>
                          <button type="button" title="Export" onClick={() => { switchThread(thread.id); setTimeout(() => exportThread(thread), 300); }}>
                            <Download size={11} />
                          </button>
                          <button type="button" title="Delete" className="chat-thread-delete" onClick={() => deleteThread(thread.id)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="chat-inline-main">
        {/* Messages */}
        <div className="chat-inline-messages">
          {messages.map((msg, idx) => {
            const isLastAi = msg.role === "ai" && idx === messages.length - 1 && loading;
            return (
              <div
                key={idx}
                className={`chat-msg-row ${msg.role === "user" ? "chat-msg-user" : "chat-msg-ai"}`}
              >
                <div className="chat-msg-avatar">
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                  ) : (
                    <Bot className="w-3.5 h-3.5" style={{ color: "#67e8f9" }} />
                  )}
                </div>
                <div className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
                  <div className="chat-bubble-content">
                    {msg.thinkingLogs && msg.thinkingLogs.length > 0 && (
                      <ThinkingLogsAccordion logs={msg.thinkingLogs} isGenerating={isLastAi} />
                    )}
                    {msg.content === "" && isLastAi ? (
                      <span className="chat-typing">
                        <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <>
                        {formatMessage(msg.content)}
                        {isLastAi && <span className="chat-stream-cursor">&#x258B;</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && streamingStatus && (
            <div className="chat-status-pill">
              <span className="chat-status-pill-dot" />
              {streamingStatus}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts (only if few messages) */}
        {messages.length <= 1 && !loading && (
          <div className="chat-quick-prompts">
            {(activeDocumentFilename
              ? [
                  "📝 Summarize this document",
                  "💡 Key takeaways & insights",
                  "🔍 Find action items/decisions",
                ]
              : QUICK_PROMPTS
            ).map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="chat-quick-btn"
                onClick={() => sendMessage(prompt.replace(/^[\p{Emoji}\s]+/u, "").trim())}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-inline-input">
          <form
            onSubmit={(e) => { e.preventDefault(); if (loading) { stopGeneration(); } else { sendMessage(); } }}
            className="chat-input-form"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about news, stocks, or your files…"
              className="chat-input-field"
              disabled={loading}
              id="chat-inline-input"
            />
            {loading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="chat-send-btn chat-stop-active"
                title="Stop generation"
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`chat-send-btn ${input.trim() ? "chat-send-active" : ""}`}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
          <div className="chat-input-hint">
            <Zap className="w-3 h-3" />
            Powered by Gemini AI · Your conversations are private
          </div>
        </div>
          </div>{/* /chat-inline-main */}
        </div>{/* /chat-inline-body */}

        <style>{`
          .chat-inline-root {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--bg-sidebar);
            border: 1px solid var(--border-medium);
            border-radius: 20px;
            overflow: hidden;
            position: relative;
          }
          .chat-sidebar-toggle {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            border-radius: 8px;
            transition: all 0.2s ease;
          }
          .chat-sidebar-toggle:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }
          .chat-model-select {
            background: #080814;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 11px;
            height: 28px;
            padding: 0 24px 0 8px;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 12px;
            transition: border-color 0.15s ease;
          }
          .chat-model-select:hover {
            border-color: rgba(34, 211, 238, 0.4);
          }
          .chat-inline-body {
            display: flex;
            flex: 1;
            overflow: hidden;
            width: 100%;
            height: 100%;
          }
          .chat-thread-sidebar {
            width: 240px;
            background: rgba(8, 8, 20, 0.4);
            border-right: 1px solid var(--border-light);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            overflow: hidden;
          }
          .chat-thread-sidebar-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 16px;
            border-bottom: 1px solid var(--border-light);
            font-size: 13px;
            font-weight: 700;
            color: var(--text-primary);
          }
          .chat-thread-count {
            margin-left: auto;
            background: rgba(34, 211, 238, 0.1);
            color: #22d3ee;
            padding: 2px 6px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .chat-thread-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .chat-thread-list::-webkit-scrollbar {
            width: 4px;
          }
          .chat-thread-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
          }
          .chat-thread-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 40px 16px;
            color: var(--text-muted);
            font-size: 13px;
            text-align: center;
          }
          .chat-thread-item {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            group: true;
            border: 1px solid transparent;
          }
          .chat-thread-item:hover {
            background: var(--bg-surface);
            border-color: var(--border-light);
          }
          .chat-thread-active {
            background: rgba(34, 211, 238, 0.08) !important;
            border-color: rgba(34, 211, 238, 0.25) !important;
          }
          .chat-thread-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 0;
          }
          .chat-thread-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .chat-thread-time {
            font-size: 11px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .chat-thread-actions {
            display: none;
            align-items: center;
            gap: 4px;
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: var(--bg-surface);
            padding: 4px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          .chat-thread-active .chat-thread-actions {
            background: rgb(15, 15, 35);
          }
          .chat-thread-item:hover .chat-thread-actions {
            display: flex;
          }
          .chat-thread-actions button {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
          }
          .chat-thread-actions button:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }
          .chat-thread-actions button.chat-thread-delete:hover {
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
          }
          .chat-thread-rename-input {
            width: 100%;
            background: var(--bg-sidebar);
            border: 1px solid rgba(34, 211, 238, 0.4);
            border-radius: 6px;
            padding: 4px 8px;
            color: var(--text-primary);
            font-size: 13px;
            outline: none;
            font-family: inherit;
          }
          .chat-inline-main {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
            height: 100%;
            position: relative;
          }
          .chat-inline-root::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent);
          }

          .chat-inline-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-light);
            background: linear-gradient(to right, rgba(34,211,238,0.06), transparent);
            flex-shrink: 0;
          }
          .chat-inline-avatar {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(34,211,238,0.22), rgba(14,165,233,0.14));
            border: 1px solid rgba(34,211,238,0.28);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 16px rgba(34,211,238,0.15);
          }
          .chat-inline-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--text-primary);
            line-height: 1;
          }
          .chat-inline-status {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 13px;
            color: var(--text-secondary);
            margin-top: 3px;
          }
          .chat-status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #34d399;
            box-shadow: 0 0 6px #34d399;
            flex-shrink: 0;
            animation: pulse 2s ease-in-out infinite;
          }
          .chat-header-actions { margin-left: auto; }
          .chat-clear-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            border-radius: 8px;
            background: var(--bg-surface);
            border: 1px solid var(--border-light);
            font-size: 13px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .chat-clear-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

          .chat-inline-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .chat-msg-row {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            max-width: 800px;
          }
          .chat-msg-user { flex-direction: row-reverse; align-self: flex-end; }
          .chat-msg-ai { align-self: flex-start; }

          .chat-msg-avatar {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 2px;
          }
          .chat-msg-user .chat-msg-avatar {
            background: var(--bg-hover);
            border: 1px solid var(--border-light);
          }
          .chat-msg-ai .chat-msg-avatar {
            background: rgba(34,211,238,0.1);
            border: 1px solid rgba(34,211,238,0.22);
          }

          .chat-bubble {
            padding: 12px 16px;
            border-radius: 16px;
            max-width: 72%;
            font-size: 15px;
            line-height: 1.6;
          }
          .chat-bubble-user {
            background: rgba(34,211,238,0.12);
            border: 1px solid rgba(34,211,238,0.25);
            border-top-right-radius: 4px;
            color: #ecfeff;
          }
          .chat-bubble-ai {
            background: var(--bg-surface);
            border: 1px solid var(--border-light);
            border-top-left-radius: 4px;
            color: var(--text-primary);
          }
          .chat-bubble-content { display: flex; flex-direction: column; gap: 4px; }
          .chat-line { margin-bottom: 2px; min-height: 1em; }

          .chat-typing {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 0;
          }
          .chat-typing-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #67e8f9;
            animation: typingBounce 1.4s infinite ease-in-out both;
          }
          @keyframes typingBounce {
            0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }

          /* ── QUICK PROMPTS ── */
          .chat-quick-prompts {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 20px 12px;
            flex-shrink: 0;
          }
          .chat-quick-btn {
            padding: 7px 14px;
            border-radius: 10px;
            background: rgba(34,211,238,0.06);
            border: 1px solid rgba(34,211,238,0.18);
            font-size: 14px;
            color: rgba(103,232,249,0.85);
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
          }
          .chat-quick-btn:hover {
            background: rgba(34,211,238,0.12);
            border-color: rgba(34,211,238,0.38);
            color: #67e8f9;
          }

          /* ── INPUT ── */
          .chat-inline-input {
            padding: 16px 20px;
            border-top: 1px solid var(--border-light);
            background: var(--bg-secondary);
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .chat-input-form {
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .chat-input-field {
            flex: 1;
            background: var(--bg-surface);
            border: 1px solid var(--border-light);
            border-radius: 14px;
            padding: 11px 16px;
            font-size: 15px;
            color: var(--text-primary);
            outline: none;
            transition: all 0.2s ease;
          }
          .chat-input-field:focus {
            background: var(--bg-hover);
            border-color: rgba(34,211,238,0.5);
            box-shadow: 0 0 0 3px rgba(34,211,238,0.1);
          }
          .chat-input-field::placeholder { color: var(--text-muted); }
          .chat-input-field:disabled { opacity: 0.5; }
          .chat-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            flex-shrink: 0;
            background: var(--bg-surface);
            border: 1px solid var(--border-light);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: not-allowed;
            color: var(--text-muted);
            transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
          }
          .chat-send-active {
            background: linear-gradient(135deg, #22d3ee, #0891b2) !important;
            border-color: rgba(34,211,238,0.5) !important;
            color: #030f1a !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(34,211,238,0.35);
          }
          .chat-send-active:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 20px rgba(34,211,238,0.55);
          }
          .chat-stop-active {
            background: rgba(239,68,68,0.18) !important;
            border-color: rgba(239,68,68,0.45) !important;
            color: #f87171 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(239,68,68,0.2);
          }
          .chat-stop-active:hover {
            background: rgba(239,68,68,0.28) !important;
            transform: scale(1.08);
          }
          /* Streaming pulsing cursor */
          .chat-stream-cursor {
            display: inline-block;
            color: #22d3ee;
            font-weight: 300;
            animation: cursorBlink 0.9s step-end infinite;
            margin-left: 1px;
            vertical-align: baseline;
          }
          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          /* Tool status pill */
          .chat-status-pill {
            display: flex;
            align-items: center;
            gap: 7px;
            align-self: flex-start;
            background: rgba(34,211,238,0.08);
            border: 1px solid rgba(34,211,238,0.2);
            border-radius: 20px;
            padding: 5px 12px;
            font-size: 13px;
            color: rgba(103,232,249,0.85);
            animation: fadeInSlide 0.2s ease;
          }
          @keyframes fadeInSlide {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .chat-status-pill-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #22d3ee;
            animation: pulse 1.2s ease-in-out infinite;
            flex-shrink: 0;
          }
          .chat-input-hint {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            color: var(--text-muted);
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80; }
            50% { opacity: 0.5; box-shadow: 0 0 2px #4ade80; }
          }
        `}</style>
      </div>
    );
  }

  // ── FLOATING FAB MODE (default) ──
  return (
    <div className="chat-floating-wrapper">
      {isOpen && (
        <div className="chat-floating-window">
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 16px 12px", borderBottom: "1px solid var(--border-light)", background: "linear-gradient(to right, rgba(34,211,238,0.06), transparent)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, marginRight: "12px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, rgba(34,211,238,0.25), rgba(14,165,233,0.15))", border: "1px solid rgba(34,211,238,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles size={15} color="#67e8f9" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "15px", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>AI Assistant</div>
                <div style={{ color: "var(--text-secondary)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", whiteSpace: "nowrap" }}>
                  <span className="chat-status-dot" style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: selectedModel === "llama-70b" ? "#c084fc" : (selectedModel === "gemini-pro" ? "#60a5fa" : "#34d399"),
                    boxShadow: selectedModel === "llama-70b" ? "0 0 6px #c084fc" : (selectedModel === "gemini-pro" ? "0 0 6px #60a5fa" : "0 0 6px #34d399"),
                    flexShrink: 0,
                    animation: "pulse 2s ease-in-out infinite"
                  }} />
                  <span style={{ lineHeight: "12px" }}>Online</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowThreadSidebar(!showThreadSidebar)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: showThreadSidebar ? "rgba(34, 211, 238, 0.15)" : "var(--bg-surface)",
                  border: showThreadSidebar ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid var(--border-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: showThreadSidebar ? "#22d3ee" : "var(--text-secondary)",
                  outline: "none"
                }}
                title="Chat History"
              >
                <History size={14} />
              </button>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="chat-model-select"
              >
                <option value="llama-70b" style={{ background: "#080814", color: "#ffffff" }}>Llama 3.3 (Groq)</option>
                <option value="gemini-pro" style={{ background: "#080814", color: "#ffffff" }}>Gemini Pro</option>
                <option value="gemini-flash" style={{ background: "#080814", color: "#ffffff" }}>Gemini Flash</option>
              </select>
              <button type="button" onClick={() => setIsOpen(false)} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Floating Thread History Overlay */}
          {showThreadSidebar && (
            <div style={{
              position: "absolute",
              top: "67px",
              left: 0,
              right: 0,
              bottom: 0,
              background: "#080814",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              borderTop: "1px solid var(--border-light)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>Chat History ({threads.length})</span>
                <button
                  type="button"
                  onClick={async () => { await startNewChat(); setShowThreadSidebar(false); }}
                  style={{
                    background: "rgba(34,211,238,0.1)",
                    border: "1px solid rgba(34,211,238,0.2)",
                    borderRadius: "6px",
                    color: "#22d3ee",
                    fontSize: "11px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Plus size={12} /> New Chat
                </button>
              </div>
              <div className="chat-thread-list" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {threads.length === 0 && (
                  <div className="chat-thread-empty">
                    <MessageSquare size={20} style={{ opacity: 0.3 }} />
                    <span>No conversations yet</span>
                  </div>
                )}
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`chat-thread-item ${activeThreadId === thread.id ? "chat-thread-active" : ""}`}
                    onClick={() => { switchThread(thread.id); setShowThreadSidebar(false); }}
                  >
                    {renamingThreadId === thread.id ? (
                      <input
                        type="text"
                        className="chat-thread-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameThread(thread.id, renameValue)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameThread(thread.id, renameValue); if (e.key === "Escape") setRenamingThreadId(null); }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="chat-thread-info">
                          <span className="chat-thread-title">{thread.title}</span>
                          <span className="chat-thread-time">
                            <Clock size={10} />
                            {timeAgo(thread.updated_at)}
                          </span>
                        </div>
                        <div className="chat-thread-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" title="Rename" onClick={() => { setRenamingThreadId(thread.id); setRenameValue(thread.title); }}>
                            <Pencil size={11} />
                          </button>
                          <button type="button" title="Export" onClick={() => { switchThread(thread.id); setTimeout(() => exportThread(thread), 300); }}>
                            <Download size={11} />
                          </button>
                          <button type="button" title="Delete" className="chat-thread-delete" onClick={() => deleteThread(thread.id)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.map((msg, idx) => {
              const isLastAi = msg.role === "ai" && idx === messages.length - 1 && loading;
              return (
                <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "var(--bg-hover)" : "rgba(34,211,238,0.12)", border: msg.role === "user" ? "1px solid var(--border-light)" : "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {msg.role === "user" ? <User size={13} color="#fff" /> : <Bot size={13} color="#67e8f9" />}
                  </div>
                  <div style={{ background: msg.role === "user" ? "rgba(34,211,238,0.15)" : "var(--bg-surface)", border: msg.role === "user" ? "1px solid rgba(34,211,238,0.25)" : "1px solid var(--border-light)", padding: "10px 14px", borderRadius: "14px", borderTopRightRadius: msg.role === "user" ? "4px" : "14px", borderTopLeftRadius: msg.role === "ai" ? "4px" : "14px", color: "var(--text-primary)", fontSize: "0.95rem", lineHeight: "1.55", maxWidth: "80%" }}>
                    {msg.thinkingLogs && msg.thinkingLogs.length > 0 && (
                      <ThinkingLogsAccordion logs={msg.thinkingLogs} isGenerating={isLastAi} />
                    )}
                    {msg.content === "" && isLastAi ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <>
                        {formatMessage(msg.content)}
                        {isLastAi && <span className="chat-stream-cursor">&#x258B;</span>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && streamingStatus && (
              <div style={{ display: "flex", alignItems: "center", gap: "7px", alignSelf: "flex-start", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: "20px", padding: "5px 12px", fontSize: "12px", color: "rgba(103,232,249,0.85)" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22d3ee", flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }} />
                {streamingStatus}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-light)", background: "var(--bg-secondary)" }}>
            <form onSubmit={(e) => { e.preventDefault(); if (loading) { stopGeneration(); } else { sendMessage(); } }} style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything…"
                disabled={loading}
                style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "9px 13px", color: "var(--text-primary)", fontSize: "0.95rem", outline: "none", opacity: loading ? 0.6 : 1 }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(34,211,238,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")}
              />
              {loading ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  style={{ width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0, background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.45)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#f87171", transition: "all 0.2s ease" }}
                  title="Stop generation"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  style={{ width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0, background: input.trim() ? "linear-gradient(135deg, #22d3ee, #0891b2)" : "var(--bg-surface)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "not-allowed", color: input.trim() ? "#030f1a" : "var(--text-muted)", transition: "all 0.2s ease" }}
                >
                  <Send size={15} />
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
        style={{ width: "56px", height: "56px", borderRadius: "18px", background: isOpen ? "linear-gradient(135deg, #0891b2, #0369a1)" : "linear-gradient(135deg, #22d3ee, #0891b2)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isOpen ? "0 8px 32px rgba(8,145,178,0.6), 0 0 0 4px rgba(34,211,238,0.15)" : "0 8px 24px rgba(34,211,238,0.4)", transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)", transform: isOpen ? "rotate(180deg) scale(1.05)" : "scale(1)" }}
        onMouseEnter={(e) => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1) translateY(-2px)"; } }}
        onMouseLeave={(e) => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; } }}
      >
        {isOpen ? <X size={22} color="#fff" /> : <MessageSquare size={22} color="#fff" />}
      </button>

      <style>{`
        .chat-floating-wrapper {
          position: fixed;
          bottom: 32px;
          right: 32px;
          z-index: 100;
        }

        .chat-floating-window {
          position: absolute;
          bottom: 68px;
          right: 0;
          width: 380px;
          height: 530px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-medium);
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(34,211,238,0.08);
          animation: slideUpFade 0.22s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #67e8f9; display: inline-block;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .chat-model-select {
          background: #080814;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 11px;
          height: 28px;
          padding: 0 24px 0 8px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 12px;
          transition: border-color 0.15s ease;
        }
        .chat-model-select:hover {
          border-color: rgba(34, 211, 238, 0.4);
        }

        /* Thread styling inside FAB mode overlay */
        .chat-thread-list {
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .chat-thread-list::-webkit-scrollbar {
          width: 4px;
        }
        .chat-thread-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .chat-thread-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 60px 16px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
        .chat-thread-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          border: 1px solid transparent;
        }
        .chat-thread-item:hover {
          background: var(--bg-surface);
          border-color: var(--border-light);
        }
        .chat-thread-active {
          background: rgba(34, 211, 238, 0.08) !important;
          border-color: rgba(34, 211, 238, 0.25) !important;
        }
        .chat-thread-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
          text-align: left;
        }
        .chat-thread-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-thread-time {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .chat-thread-actions {
          display: none;
          align-items: center;
          gap: 4px;
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-surface);
          padding: 4px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .chat-thread-active .chat-thread-actions {
          background: rgb(15, 15, 35);
        }
        .chat-thread-item:hover .chat-thread-actions {
          display: flex;
        }
        .chat-thread-actions button {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .chat-thread-actions button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .chat-thread-actions button.chat-thread-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .chat-thread-rename-input {
          width: 100%;
          background: var(--bg-sidebar);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 6px;
          padding: 4px 8px;
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
          font-family: inherit;
        }

        @media (max-width: 600px) {
          .chat-floating-wrapper {
            bottom: 80px !important;
            right: 16px !important;
          }
          .chat-floating-window {
            position: fixed !important;
            bottom: 146px !important;
            right: 16px !important;
            left: 16px !important;
            width: auto !important;
            height: calc(100vh - 180px) !important;
            max-height: 520px !important;
            box-shadow: 0 16px 48px rgba(0,0,0,0.85) !important;
          }
        }
      `}</style>
    </div>
  );
}
