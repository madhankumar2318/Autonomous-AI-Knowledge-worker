"use client";
import { Send, Bot, User, X, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "Hi! I'm your AI Knowledge Worker. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", content: data.reply }]);
    } catch {
      showToast("error", "Failed to connect to AI server.");
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I am currently offline." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={panelRef} style={{ position: "fixed", bottom: "32px", right: "32px", zIndex: 100 }}>
      {/* Slide-up Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "68px",
            right: "0",
            width: "350px",
            height: "500px",
            background: "rgba(18,18,24,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: "20px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.15)",
            animation: "slideUpFade 0.22s ease",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(to right, rgba(168,85,247,0.1), rgba(18,18,24,0))"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "10px",
                background: "linear-gradient(135deg, #a855f7, #6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(168,85,247,0.4)",
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>AI Assistant</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", margin: 0, display: "flex", alignItems:"center", gap:"4px" }}>
                   <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4ade80",display:"inline-block"}} /> Online
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                width: "28px", height: "28px", borderRadius: "8px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "20px",
            display: "flex", flexDirection: "column", gap: "16px"
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: "flex", gap: "12px",
                alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row"
              }}>
                {/* Avatar */}
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: msg.role === "user" ? "rgba(255,255,255,0.1)" : "rgba(168,85,247,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {msg.role === "user" ? <User size={14} color="#fff" /> : <Bot size={14} color="#d8b4fe" />}
                </div>
                
                {/* Bubble */}
                <div style={{
                  background: msg.role === "user" ? "rgba(255,255,255,0.1)" : "rgba(168,85,247,0.15)",
                  border: msg.role === "user" ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(168,85,247,0.3)",
                  padding: "10px 14px", borderRadius: "14px",
                  borderTopRightRadius: msg.role === "user" ? "4px" : "14px",
                  borderTopLeftRadius: msg.role === "ai" ? "4px" : "14px",
                  color: "#fff", fontSize: "0.85rem", lineHeight: "1.5",
                  maxWidth: "80%"
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {loading && (
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Bot size={14} color="#d8b4fe" />
                </div>
                <div style={{
                  background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                  padding: "10px 14px", borderRadius: "14px", borderTopLeftRadius: "4px",
                  display: "flex", alignItems: "center", gap: "4px"
                }}>
                  <div className="typing-dot" style={{animationDelay: "0ms"}}></div>
                  <div className="typing-dot" style={{animationDelay: "150ms"}}></div>
                  <div className="typing-dot" style={{animationDelay: "300ms"}}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.2)"
          }}>
            <form onSubmit={sendMessage} style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                style={{
                  flex: 1, background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px", padding: "10px 14px",
                  color: "#fff", fontSize: "0.85rem", outline: "none",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                style={{
                  width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
                  background: input.trim() && !loading ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(255,255,255,0.1)",
                  border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.4)",
                  transition: "all 0.2s ease"
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
        style={{
          width: "56px", height: "56px", borderRadius: "18px",
          background: isOpen
            ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
            : "linear-gradient(135deg, #9333ea, #6366f1)",
          border: "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isOpen
            ? "0 8px 32px rgba(124,58,237,0.7), 0 0 0 4px rgba(168,85,247,0.2)"
            : "0 8px 24px rgba(147,51,234,0.5)",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: isOpen ? "rotate(180deg) scale(1.05)" : "scale(1)",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.transform = "scale(1.1) translateY(-2px)";
            b.style.boxShadow = "0 12px 32px rgba(147,51,234,0.7)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.transform = "scale(1)";
            b.style.boxShadow = "0 8px 24px rgba(147,51,234,0.5)";
          }
        }}
      >
        {isOpen
          ? <X size={22} color="#fff" />
          : <MessageSquare size={22} color="#fff" />
        }
      </button>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #d8b4fe;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
