"use client";
import {
  Bot,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

interface ChatAssistantProps {
  username?: string;
  inline?: boolean;
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
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content:
        "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
            <span style={{ color: "#a855f7", flexShrink: 0, lineHeight: "1.6" }}>▸</span>
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
          <code key={index} style={{ background: "rgba(168,85,247,0.15)", padding: "1px 6px", borderRadius: "4px", color: "#c4b5fd", fontFamily: "monospace", fontSize: "0.85em", border: "1px solid rgba(168,85,247,0.2)" }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#a855f7", textDecoration: "underline", fontWeight: 600 }}>
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const sendMessage = async (text?: string) => {
    const userMessage = (text ?? input).trim();
    if (!userMessage || loading) return;
    setInput("");

    const updatedMessages = [
      ...messages,
      { role: "user", content: userMessage } as ChatMessage,
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const chatHistory = messages.map((msg) => ({
        role: msg.role === "ai" ? "ai" : "user",
        content: msg.content,
      }));
      const res = await fetch("http://127.0.0.1:8000/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, username, history: chatHistory }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch {
      showToast("error", "Failed to connect to AI server.");
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Sorry, I'm currently offline. Please check if the backend server is running." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── INLINE (full-page tab) MODE ──
  if (inline) {
    return (
      <div className="chat-inline-root">
        {/* Header */}
        <div className="chat-inline-header">
          <div className="chat-inline-avatar">
            <Sparkles className="w-4 h-4" style={{ color: "#d8b4fe" }} />
          </div>
          <div>
            <div className="chat-inline-title">AI Knowledge Worker</div>
            <div className="chat-inline-status">
              <span className="chat-status-dot" />
              <span>Online · Powered by Gemini</span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              onClick={() => setMessages([{ role: "ai", content: "Hi! I'm your AI Knowledge Worker. How can I help you today?" }])}
              className="chat-clear-btn"
              title="Clear conversation"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-inline-messages">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-msg-row ${msg.role === "user" ? "chat-msg-user" : "chat-msg-ai"}`}
            >
              <div className="chat-msg-avatar">
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                ) : (
                  <Bot className="w-3.5 h-3.5" style={{ color: "#d8b4fe" }} />
                )}
              </div>
              <div className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
                <div className="chat-bubble-content">
                  {formatMessage(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg-row chat-msg-ai">
              <div className="chat-msg-avatar">
                <Bot className="w-3.5 h-3.5" style={{ color: "#d8b4fe" }} />
              </div>
              <div className="chat-bubble chat-bubble-ai">
                <div className="chat-typing">
                  <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                  <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                  <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts (only if few messages) */}
        {messages.length <= 1 && !loading && (
          <div className="chat-quick-prompts">
            {QUICK_PROMPTS.map((prompt, i) => (
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
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
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
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`chat-send-btn ${input.trim() && !loading ? "chat-send-active" : ""}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          <div className="chat-input-hint">
            <Zap className="w-3 h-3" />
            Powered by Gemini AI · Your conversations are private
          </div>
        </div>

        <style>{`
          .chat-inline-root {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: rgba(8,8,20,0.6);
            border: 1px solid rgba(168,85,247,0.15);
            border-radius: 20px;
            overflow: hidden;
            position: relative;
          }
          .chat-inline-root::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(168,85,247,0.5), transparent);
          }

          .chat-inline-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: linear-gradient(to right, rgba(168,85,247,0.07), transparent);
            flex-shrink: 0;
          }
          .chat-inline-avatar {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(168,85,247,0.3), rgba(99,102,241,0.2));
            border: 1px solid rgba(168,85,247,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 16px rgba(168,85,247,0.2);
          }
          .chat-inline-title {
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            line-height: 1;
          }
          .chat-inline-status {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            color: rgba(255,255,255,0.35);
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
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            font-size: 11px;
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .chat-clear-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

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
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
          }
          .chat-msg-ai .chat-msg-avatar {
            background: rgba(168,85,247,0.15);
            border: 1px solid rgba(168,85,247,0.25);
          }

          .chat-bubble {
            padding: 12px 16px;
            border-radius: 16px;
            max-width: 72%;
            font-size: 13.5px;
            line-height: 1.6;
          }
          .chat-bubble-user {
            background: rgba(168,85,247,0.2);
            border: 1px solid rgba(168,85,247,0.3);
            border-top-right-radius: 4px;
            color: #f0e6ff;
          }
          .chat-bubble-ai {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-top-left-radius: 4px;
            color: rgba(255,255,255,0.85);
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
            background: #d8b4fe;
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
            background: rgba(168,85,247,0.07);
            border: 1px solid rgba(168,85,247,0.2);
            font-size: 12px;
            color: rgba(216,180,254,0.85);
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
          }
          .chat-quick-btn:hover {
            background: rgba(168,85,247,0.14);
            border-color: rgba(168,85,247,0.4);
            color: #d8b4fe;
          }

          /* ── INPUT ── */
          .chat-inline-input {
            padding: 16px 20px;
            border-top: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.2);
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
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px;
            padding: 11px 16px;
            font-size: 13px;
            color: #fff;
            outline: none;
            transition: all 0.2s ease;
          }
          .chat-input-field:focus {
            background: rgba(255,255,255,0.07);
            border-color: rgba(168,85,247,0.5);
            box-shadow: 0 0 0 3px rgba(168,85,247,0.1);
          }
          .chat-input-field::placeholder { color: rgba(255,255,255,0.25); }
          .chat-input-field:disabled { opacity: 0.5; }
          .chat-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: not-allowed;
            color: rgba(255,255,255,0.3);
            transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
          }
          .chat-send-active {
            background: linear-gradient(135deg, #a855f7, #6366f1) !important;
            border-color: rgba(168,85,247,0.5) !important;
            color: #fff !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(168,85,247,0.4);
          }
          .chat-send-active:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 20px rgba(168,85,247,0.6);
          }
          .chat-input-hint {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 10px;
            color: rgba(255,255,255,0.2);
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
    <div style={{ position: "fixed", bottom: "32px", right: "32px", zIndex: 100 }}>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "68px",
            right: "0",
            width: "380px",
            height: "530px",
            background: "rgba(8,8,20,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(168,85,247,0.25)",
            borderRadius: "20px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(168,85,247,0.12)",
            animation: "slideUpFade 0.22s ease",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(to right, rgba(168,85,247,0.08), transparent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(99,102,241,0.2))", border: "1px solid rgba(168,85,247,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={15} color="#d8b4fe" />
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", margin: 0, lineHeight: 1 }}>AI Assistant</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.68rem", margin: 0, display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 5px #4ade80" }} />
                  Online · Gemini AI
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.45)" }}>
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "rgba(255,255,255,0.08)" : "rgba(168,85,247,0.15)", border: msg.role === "user" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {msg.role === "user" ? <User size={13} color="#fff" /> : <Bot size={13} color="#d8b4fe" />}
                </div>
                <div style={{ background: msg.role === "user" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)", border: msg.role === "user" ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.07)", padding: "10px 14px", borderRadius: "14px", borderTopRightRadius: msg.role === "user" ? "4px" : "14px", borderTopLeftRadius: msg.role === "ai" ? "4px" : "14px", color: "#e2e8f0", fontSize: "0.83rem", lineHeight: "1.55", maxWidth: "80%" }}>
                  {formatMessage(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={13} color="#d8b4fe" />
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "12px 14px", borderRadius: "14px", borderTopLeftRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                  <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                  <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything…"
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "9px 13px", color: "#fff", fontSize: "0.83rem", outline: "none" }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(168,85,247,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                style={{ width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0, background: input.trim() && !loading ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(255,255,255,0.07)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.3)", transition: "all 0.2s ease" }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
        style={{ width: "56px", height: "56px", borderRadius: "18px", background: isOpen ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "linear-gradient(135deg, #9333ea, #6366f1)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isOpen ? "0 8px 32px rgba(124,58,237,0.7), 0 0 0 4px rgba(168,85,247,0.2)" : "0 8px 24px rgba(147,51,234,0.5)", transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)", transform: isOpen ? "rotate(180deg) scale(1.05)" : "scale(1)" }}
        onMouseEnter={(e) => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1) translateY(-2px)"; } }}
        onMouseLeave={(e) => { if (!isOpen) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; } }}
      >
        {isOpen ? <X size={22} color="#fff" /> : <MessageSquare size={22} color="#fff" />}
      </button>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #d8b4fe; display: inline-block;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
