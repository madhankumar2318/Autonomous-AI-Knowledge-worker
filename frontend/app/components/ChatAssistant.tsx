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
  Sliders,
  Mic,
  MicOff,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { showToast } from "./Toast";
import { API_BASE_URL } from "../config";
import ThinkingLogsAccordion, { type ToolLog } from "./ThinkingLogsAccordion";
import { formatMessage } from "./chatFormatters";

// ── Assistant Presets ─────────────────────────────────────────────────────────
export const PRESETS = {
  default: {
    name: "Balanced",
    prompt: "",
    temp: 0.1,
    icon: "🤖",
    desc: "General purpose helper",
  },
  finance: {
    name: "Finance Guru",
    prompt: "You are a professional Financial Analyst. Present stock comparisons, news, and stats in structured tables. Emphasize price variations, market capitalization, daily percentage changes, and key trends. Provide short, bulleted summaries followed by a clear, bold market takeaway at the end.",
    temp: 0.1,
    icon: "📊",
    desc: "Optimized for market & stock analysis",
  },
  research: {
    name: "Scholar",
    prompt: "You are a thorough Research Scholar. Focus on detailed, long-form explanations with clear academic citation of source files. When referencing knowledge base data, always mention the document and the relevance percentage inline. Structure your answer with clear headers, bullet lists, and a final insight summary.",
    temp: 0.2,
    icon: "🔍",
    desc: "Long-form detailed answers with RAG",
  },
  code: {
    name: "Code Wizard",
    prompt: "You are an expert Software Engineer. Write clean, commented, and syntactically correct code blocks. Walk through the logic step-by-step using ordered bullet lists. Highlight security best practices and optimization suggestions.",
    temp: 0.1,
    icon: "💻",
    desc: "Optimized for programming & code design",
  }
};


interface ChatMessage {
  role: "user" | "ai";
  content: string;
  thinkingLogs?: string[];
  toolLogs?: ToolLog[];
  model?: string;
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


// ThinkingLogsAccordion extracted â†’ ./ThinkingLogsAccordion.tsx
// chatFormatters extracted â†’ ./chatFormatters.tsx

const QUICK_PROMPTS = [
  "ðŸ“Š Summarize today's top news",
  "ðŸ“ˆ What are the best performing stocks?",
  "ðŸ” Analyze market sentiment",
  "ðŸ’¡ What should I know today?",
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
      localStorage.setItem("ak_selected_model_modified", "true");
    }
  };

  useEffect(() => {
    if (username && username !== "guest") {
      fetch(`${API_BASE_URL}/settings/`, { credentials: "include" })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((data) => {
          if (data && data.default_model) {
            if (typeof window !== "undefined" && !localStorage.getItem("ak_selected_model_modified")) {
              setSelectedModel(data.default_model);
            }
          }
        })
        .catch(() => {});
    }
  }, [username]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      content: activeDocumentFilename
        ? `ðŸ“„ **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document â€” I'll search it and give you precise, cited answers.`
        : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string>("");

  // â”€â”€ Thread History State â”€â”€
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showThreadSidebar, setShowThreadSidebar] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Parameters & Preset Settings state ──
  const [temperature, setTemperature] = useState(0.1);
  const [activePreset, setActivePreset] = useState<keyof typeof PRESETS>("default");
  const [showParamsPanel, setShowParamsPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition hook
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
        };
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput((prev) => (prev ? prev + " " + transcript : transcript));
            showToast("success", `Voice input: "${transcript}"`);
          }
        };
        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          showToast("error", "Voice input failed or was denied.");
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast("error", "Speech recognition not supported in this browser. Use Chrome or Safari.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const welcomeMessage = (): ChatMessage => ({
    role: "ai",
    content: activeDocumentFilename
      ? `ðŸ“„ **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document â€” I'll search it and give you precise, cited answers.`
      : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
  });

  // â”€â”€ Thread CRUD Helpers â”€â”€
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

  // Citation click â€” fires a custom DOM event so the PDF viewer can scroll to the page
  const handleCitationClick = (filename: string, phrase: string, pageNum?: number) => {
    const event = new CustomEvent("open-rag-document", {
      detail: { filename, phrase, pageNum },
    });
    window.dispatchEvent(event);
  };

  // Bind citation handler into the imported formatter so call-sites stay simple
  const renderMessage = (text: string) => formatMessage(text, handleCitationClick);

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
          temperature,
          system_prompt: PRESETS[activePreset].prompt || undefined,
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
            } else if (event.type === "model_used") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = {
                    ...last,
                    model: event.content,
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
            } else if (event.type === "tool_start") {
              try {
                const startData = JSON.parse(event.content) as { id: string; name: string; arguments?: string };
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "ai") {
                    const tools = last.toolLogs ? [...last.toolLogs] : [];
                    if (!tools.some((t) => t.id === startData.id)) {
                      tools.push({
                        id: startData.id,
                        name: startData.name,
                        arguments: startData.arguments,
                        status: "executing",
                      });
                    }
                    updated[updated.length - 1] = {
                      ...last,
                      toolLogs: tools,
                    };
                  }
                  return updated;
                });
              } catch (e) {
                console.error("Failed to parse tool_start SSE event", e);
              }
            } else if (event.type === "tool_end") {
              try {
                const endData = JSON.parse(event.content) as { id: string; name: string; status: "success" | "error"; output?: string };
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "ai") {
                    const tools = last.toolLogs ? last.toolLogs.map((t) => {
                      if (t.id === endData.id) {
                        return {
                          ...t,
                          status: endData.status,
                          output: endData.output,
                        };
                      }
                      return t;
                    }) : [];
                    updated[updated.length - 1] = {
                      ...last,
                      toolLogs: tools,
                    };
                  }
                  return updated;
                });
              } catch (e) {
                console.error("Failed to parse tool_end SSE event", e);
              }
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
        // User stopped generation â€” finalize the partial message as-is
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

  // â”€â”€ INLINE (full-page tab) MODE â”€â”€
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
              <span>Online Â· {selectedModel === "llama-70b" ? "Llama 3.3 70B (Groq)" : (selectedModel === "gemini-pro" ? "Gemini 2.5 Pro" : "Gemini 2.5 Flash")}</span>
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
                    {((msg.toolLogs && msg.toolLogs.length > 0) || (msg.thinkingLogs && msg.thinkingLogs.length > 0)) && (
                      <ThinkingLogsAccordion
                        logs={msg.thinkingLogs || []}
                        toolLogs={msg.toolLogs}
                        isGenerating={isLastAi}
                      />
                    )}
                    {msg.content === "" && isLastAi ? (
                      <span className="chat-typing">
                        <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                        <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <>
                        {renderMessage(msg.content)}
                        {isLastAi && <span className="chat-stream-cursor">&#x258B;</span>}
                        {msg.model && (
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textAlign: "right", opacity: 0.8 }}>
                            âš¡ {msg.model}
                          </div>
                        )}
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
                  "ðŸ“ Summarize this document",
                  "ðŸ’¡ Key takeaways & insights",
                  "ðŸ” Find action items/decisions",
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
              placeholder="Ask me anything about news, stocks, or your filesâ€¦"
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
            Powered by Gemini AI Â· Your conversations are private
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

          /* â”€â”€ QUICK PROMPTS â”€â”€ */
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

          /* â”€â”€ INPUT â”€â”€ */
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
        <div className="chat-floating-window scale-in-smooth">

          {/* ── Header ── */}
          <div className="cfab-header">
            {/* History rail toggle */}
            <button
              type="button"
              className={`cfab-icon-btn ${showThreadSidebar ? "cfab-icon-btn--active" : ""}`}
              onClick={() => setShowThreadSidebar(!showThreadSidebar)}
              title={showThreadSidebar ? "Hide history" : "Chat History"}
            >
              <History size={14} />
            </button>



            <div className="cfab-avatar" style={{ marginLeft: "6px" }}>
              <Sparkles size={14} color="#67e8f9" />
            </div>
            <div className="cfab-title-block">
              <div className="cfab-title">AI Assistant</div>
              <div className="cfab-subtitle">
                <span
                  className="cfab-dot"
                  style={{
                    background: selectedModel === "llama-70b" ? "#c084fc" : selectedModel === "gemini-pro" ? "#60a5fa" : "#34d399",
                    boxShadow: selectedModel === "llama-70b" ? "0 0 6px #c084fc" : selectedModel === "gemini-pro" ? "0 0 6px #60a5fa" : "0 0 6px #34d399",
                  }}
                />
                Online
              </div>
            </div>
            <div className="cfab-header-actions">
              <select value={selectedModel} onChange={(e) => handleModelChange(e.target.value)} className="chat-model-select">
                <option value="llama-70b" style={{ background: "#080814", color: "#fff" }}>Llama 3.3 (Groq)</option>
                <option value="gemini-pro" style={{ background: "#080814", color: "#fff" }}>Gemini Pro</option>
                <option value="gemini-flash" style={{ background: "#080814", color: "#fff" }}>Gemini Flash</option>
              </select>
              <button type="button" className="cfab-icon-btn" onClick={() => setIsOpen(false)} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="cfab-body" style={{ position: "relative" }}>

            {/* Glassmorphic Dropdown History Panel overlay */}
            {showThreadSidebar && (
              <div className="cfab-history-dropdown scale-in-smooth">
                <div className="cfab-dropdown-header">
                  <span>Chat History ({threads.length})</span>
                  <button
                    type="button"
                    className="cfab-dropdown-new"
                    onClick={async () => {
                      await startNewChat();
                      setShowThreadSidebar(false);
                    }}
                    title="New Conversation"
                  >
                    <Plus size={11} />
                    <span>New Chat</span>
                  </button>
                </div>
                <div className="cfab-dropdown-list">
                  {threads.length === 0 && (
                    <div className="cfab-dropdown-empty">
                      <MessageSquare size={16} style={{ opacity: 0.3, marginBottom: "4px" }} />
                      <span>No conversations yet</span>
                    </div>
                  )}
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      className={`cfab-dropdown-item ${activeThreadId === thread.id ? "cfab-dropdown-item--active" : ""}`}
                      onClick={() => {
                        switchThread(thread.id);
                        setShowThreadSidebar(false);
                      }}
                    >
                      {renamingThreadId === thread.id ? (
                        <input
                          type="text"
                          className="cfab-rename-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => renameThread(thread.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameThread(thread.id, renameValue);
                            if (e.key === "Escape") setRenamingThreadId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: "2px 6px" }}
                        />
                      ) : (
                        <>
                          <div className="cfab-dropdown-info">
                            <span className="cfab-dropdown-title">{thread.title}</span>
                            <span className="cfab-dropdown-time">
                              <Clock size={9} />
                              {timeAgo(thread.updated_at)}
                            </span>
                          </div>
                          <div className="cfab-dropdown-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title="Rename"
                              onClick={() => {
                                setRenamingThreadId(thread.id);
                                setRenameValue(thread.title);
                              }}
                            >
                              <Pencil size={9} />
                            </button>
                            <button
                              type="button"
                              title="Export"
                              onClick={() => {
                                switchThread(thread.id);
                                setTimeout(() => exportThread(thread), 300);
                              }}
                            >
                              <Download size={9} />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              className="cfab-dropdown-del"
                              onClick={() => deleteThread(thread.id)}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CHAT PANEL */}
            <div className="cfab-chat">
              <div className="cfab-messages">
                {messages.map((msg, idx) => {
                  const isLastAi = msg.role === "ai" && idx === messages.length - 1 && loading;
                  return (
                    <div key={idx} className="animate-message-bubble" style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                      <div className={`cfab-avatar-sm ${msg.role === "user" ? "cfab-avatar-user" : "cfab-avatar-ai"}`}>
                        {msg.role === "user" ? <User size={12} color="#fff" /> : <Bot size={12} color="#67e8f9" />}
                      </div>
                      <div className={`cfab-bubble ${msg.role === "user" ? "cfab-bubble-user" : "cfab-bubble-ai"}`}>
                        {((msg.toolLogs && msg.toolLogs.length > 0) || (msg.thinkingLogs && msg.thinkingLogs.length > 0)) && (
                          <ThinkingLogsAccordion logs={msg.thinkingLogs || []} toolLogs={msg.toolLogs} isGenerating={isLastAi} />
                        )}
                        {msg.content === "" && isLastAi ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
                            <span className="chat-typing-dot" style={{ animationDelay: "150ms" }} />
                            <span className="chat-typing-dot" style={{ animationDelay: "300ms" }} />
                          </span>
                        ) : (
                          <>
                            {renderMessage(msg.content)}
                            {isLastAi && <span className="chat-stream-cursor">&#x258B;</span>}
                            {msg.model && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textAlign: "right", opacity: 0.7 }}>⚡ {msg.model}</div>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {loading && streamingStatus && (
                  <div className="cfab-status-pill">
                    <span className="cfab-status-dot" />
                    {streamingStatus}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="cfab-input-bar">
                <form onSubmit={(e) => { e.preventDefault(); if (loading) { stopGeneration(); } else { sendMessage(); } }} className="cfab-input-form">
                  {/* Hands-free Voice Input toggle */}
                  <button
                    type="button"
                    className={`cfab-mic-btn ${isListening ? "cfab-mic-btn--active" : ""}`}
                    onClick={toggleListening}
                    title={isListening ? "Listening... Click to stop" : "Voice Input (Speech-to-Text)"}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening to your voice..." : "Ask me anything…"}
                    disabled={loading}
                    className="cfab-input-field"
                    onFocus={(e) => (e.target.style.borderColor = "rgba(34,211,238,0.5)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")}
                  />
                  {loading ? (
                    <button type="button" onClick={stopGeneration} className="cfab-send-btn cfab-stop" title="Stop">
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} className={`cfab-send-btn ${input.trim() ? "cfab-send-active" : ""}`}>
                      <Send size={13} />
                    </button>
                  )}
                </form>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* FAB */}
      <button type="button" onClick={() => setIsOpen(!isOpen)} title="AI Assistant" className={`chat-fab ${isOpen ? "chat-fab-active" : "fab-pulse-glow"}`}>
        {isOpen ? <X size={22} color="#fff" /> : <MessageSquare size={22} color="#fff" />}
      </button>

      <style>{`
        .chat-floating-wrapper { position: fixed; bottom: 32px; right: 32px; z-index: 100; }

        .chat-floating-window {
          position: absolute; bottom: 68px; right: 0;
          width: 400px; height: 540px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-medium); border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(34,211,238,0.08);
          display: flex; flex-direction: column; overflow: hidden;
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        /* Dynamic width classes */
        .cfab-window-expanded-left { width: 540px; }
        .cfab-window-expanded-right { width: 550px; }
        .cfab-window-expanded-both { width: 690px; }

        .chat-fab {
          width: 56px; height: 56px; border-radius: 18px;
          background: linear-gradient(135deg, #22d3ee, #0891b2);
          border: 1px solid rgba(255,255,255,0.15); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(34,211,238,0.4);
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); outline: none;
        }
        .chat-fab:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 12px 28px rgba(34,211,238,0.55); }
        .chat-fab-active {
          background: linear-gradient(135deg, #0891b2, #0369a1) !important;
          box-shadow: 0 8px 32px rgba(8,145,178,0.6), 0 0 0 4px rgba(34,211,238,0.15) !important;
          transform: rotate(180deg) scale(1.05) !important;
        }

        /* Header */
        .cfab-header {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 13px; flex-shrink: 0;
          border-bottom: 1px solid var(--border-light);
          background: linear-gradient(to right, rgba(34,211,238,0.06), transparent);
        }
        .cfab-icon-btn {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--bg-surface); border: 1px solid var(--border-light);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-secondary); flex-shrink: 0;
          outline: none; transition: all 0.15s ease;
        }
        .cfab-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cfab-icon-btn--active { background: rgba(34,211,238,0.15) !important; border-color: rgba(34,211,238,0.35) !important; color: #22d3ee !important; }
        .cfab-avatar {
          width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(135deg, rgba(34,211,238,0.22), rgba(14,165,233,0.14));
          border: 1px solid rgba(34,211,238,0.28);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cfab-title-block { flex: 1; min-width: 0; }
        .cfab-title { font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
        .cfab-subtitle { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .cfab-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; animation: cfab-pulse 2s ease-in-out infinite; }
        @keyframes cfab-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .cfab-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: auto; }

        /* Body */
        .cfab-body { display: flex; flex: 1; overflow: hidden; }
        
        /* Premium Glassmorphic Dropdown Panel */
        .cfab-history-dropdown {
          position: absolute;
          top: 10px;
          left: 12px;
          right: 12px;
          height: 310px;
          background: rgba(8, 8, 20, 0.85);
          backdrop-filter: blur(18px) saturate(180%);
          -webkit-backdrop-filter: blur(18px) saturate(180%);
          border: 1px solid rgba(34, 211, 238, 0.18);
          border-radius: 14px;
          z-index: 90;
          display: flex;
          flex-direction: column;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.6), 
                      0 0 0 1px rgba(255, 255, 255, 0.05);
          animation: slideDownFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .cfab-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }
        .cfab-dropdown-header span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .cfab-dropdown-new {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(8, 145, 178, 0.05));
          border: 1px solid rgba(34, 211, 238, 0.3);
          border-radius: 6px;
          color: #22d3ee;
          font-size: 10.5px;
          font-weight: 600;
          padding: 3.5px 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }
        .cfab-dropdown-new:hover {
          background: rgba(34, 211, 238, 0.25);
          border-color: rgba(34, 211, 238, 0.45);
        }
        
        .cfab-dropdown-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cfab-dropdown-list::-webkit-scrollbar { width: 3px; }
        .cfab-dropdown-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.07);
          border-radius: 4px;
        }
        .cfab-dropdown-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          color: var(--text-muted);
          font-size: 11px;
        }
        
        .cfab-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 10px;
          cursor: pointer;
          border: 1px solid transparent;
          position: relative;
          transition: all 0.15s ease;
        }
        .cfab-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.06);
        }
        .cfab-dropdown-item--active {
          background: rgba(34, 211, 238, 0.06) !important;
          border-color: rgba(34, 211, 238, 0.2) !important;
        }
        .cfab-dropdown-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .cfab-dropdown-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }
        .cfab-dropdown-time {
          font-size: 10px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4.5px;
          margin-top: 1px;
        }
        
        /* Hover actions inside dropdown items */
        .cfab-dropdown-actions {
          display: none;
          align-items: center;
          gap: 3px;
          background: #080814;
          border: 1px solid rgba(255,255,255,0.06);
          padding: 2.5px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
        }
        .cfab-dropdown-item:hover .cfab-dropdown-actions {
          display: flex;
        }
        .cfab-dropdown-actions button {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 3.5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .cfab-dropdown-actions button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .cfab-dropdown-del:hover {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #f87171 !important;
        }


        /* Rail */
        .cfab-rail {
          width: 0; overflow: hidden; flex-shrink: 0;
          display: flex; flex-direction: column;
          background: rgba(6,6,18,0.65);
          border-right: 0px solid var(--border-light);
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1), border-right-width 0.1s ease;
        }
        .cfab-rail--open { width: 140px; border-right-width: 1px; }
        .cfab-rail-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 9px 7px; flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .cfab-rail-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); white-space: nowrap; }
        .cfab-new-btn {
          width: 20px; height: 20px; border-radius: 5px;
          background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.2);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #22d3ee; flex-shrink: 0; transition: all 0.15s ease;
        }
        .cfab-new-btn:hover { background: rgba(34,211,238,0.2); }
        .cfab-rail-list { flex: 1; overflow-y: auto; padding: 5px; display: flex; flex-direction: column; gap: 2px; }
        .cfab-rail-list::-webkit-scrollbar { width: 3px; }
        .cfab-rail-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        .cfab-rail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 28px 8px; color: var(--text-muted); font-size: 10.5px; text-align: center; }
        .cfab-rail-item {
          padding: 7px 7px; border-radius: 7px; cursor: pointer;
          transition: all 0.15s ease; border: 1px solid transparent;
          position: relative; min-width: 0;
        }
        .cfab-rail-item:hover { background: var(--bg-surface); border-color: var(--border-light); }
        .cfab-rail-item--active { background: rgba(34,211,238,0.09) !important; border-color: rgba(34,211,238,0.25) !important; }
        .cfab-rail-item-inner { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .cfab-rail-title { font-size: 11px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .cfab-rail-time { font-size: 9.5px; color: var(--text-muted); display: flex; align-items: center; gap: 3px; white-space: nowrap; margin-top: 1px; }
        .cfab-rail-actions {
          display: none; position: absolute; bottom: 3px; right: 3px;
          background: var(--bg-sidebar); border: 1px solid var(--border-light);
          border-radius: 5px; padding: 2px; gap: 1px; align-items: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .cfab-rail-item:hover .cfab-rail-actions { display: flex; }
        .cfab-rail-actions button {
          background: none; border: none; cursor: pointer; color: var(--text-secondary);
          padding: 3px; border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.15s;
        }
        .cfab-rail-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }
        .cfab-del-btn:hover { background: rgba(239,68,68,0.15) !important; color: #f87171 !important; }
        .cfab-rename-input {
          width: 100%; background: var(--bg-sidebar); border: 1px solid rgba(34,211,238,0.4);
          border-radius: 5px; padding: 3px 5px; color: var(--text-primary); font-size: 11px; outline: none; font-family: inherit;
        }

        /* Chat panel */
        .cfab-chat { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .cfab-messages { flex: 1; overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 11px; scroll-behavior: smooth; }
        .cfab-messages::-webkit-scrollbar { width: 3px; }
        .cfab-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        .cfab-avatar-sm { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
        .cfab-avatar-user { background: var(--bg-hover); border: 1px solid var(--border-light); }
        .cfab-avatar-ai  { background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.25); }
        .cfab-bubble { padding: 8px 12px; border-radius: 13px; font-size: 0.88rem; line-height: 1.55; max-width: 84%; }
        .cfab-bubble-user { background: rgba(34,211,238,0.13); border: 1px solid rgba(34,211,238,0.25); border-top-right-radius: 4px; color: #ecfeff; }
        .cfab-bubble-ai  { background: var(--bg-surface); border: 1px solid var(--border-light); border-top-left-radius: 4px; color: var(--text-primary); }
        .cfab-status-pill { display: flex; align-items: center; gap: 7px; align-self: flex-start; background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); border-radius: 20px; padding: 4px 10px; font-size: 11px; color: rgba(103,232,249,0.85); }
        .cfab-status-dot { width: 5px; height: 5px; border-radius: 50%; background: #22d3ee; animation: cfab-pulse 1.2s ease-in-out infinite; flex-shrink: 0; }

        /* Input */
        .cfab-input-bar { padding: 9px 11px; border-top: 1px solid var(--border-light); background: var(--bg-secondary); flex-shrink: 0; }
        .cfab-input-form { display: flex; gap: 7px; align-items: center; }
        .cfab-input-field {
          flex: 1; background: var(--bg-surface); border: 1px solid var(--border-light);
          border-radius: 11px; padding: 7px 11px; font-size: 0.88rem; color: var(--text-primary);
          outline: none; transition: border-color 0.2s ease; font-family: inherit;
        }
        .cfab-input-field::placeholder { color: var(--text-muted); }
        .cfab-input-field:disabled { opacity: 0.5; }
        .cfab-send-btn {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          background: var(--bg-surface); border: 1px solid var(--border-light);
          display: flex; align-items: center; justify-content: center;
          cursor: not-allowed; color: var(--text-muted); outline: none;
          transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .cfab-send-active { background: linear-gradient(135deg,#22d3ee,#0891b2) !important; border-color: transparent !important; color: #030f1a !important; cursor: pointer !important; box-shadow: 0 4px 14px rgba(34,211,238,0.35); }
        .cfab-send-active:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(34,211,238,0.5); }
        .cfab-stop { background: rgba(239,68,68,0.15) !important; border-color: rgba(239,68,68,0.4) !important; color: #f87171 !important; cursor: pointer !important; }
        .cfab-stop:hover { background: rgba(239,68,68,0.25) !important; }

        /* Shared */
        .chat-model-select {
          background: #080814; border: 1px solid var(--border-light); border-radius: 8px;
          color: var(--text-primary); font-size: 11px; height: 28px; padding: 0 24px 0 8px;
          font-weight: 600; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat; background-position: right 8px center; background-size: 12px; transition: border-color 0.15s ease;
        }
        .chat-model-select:hover { border-color: rgba(34,211,238,0.4); }

        /* Animations */
        @keyframes slideUpFade { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .chat-typing-dot { width:6px;height:6px;border-radius:50%;background:#67e8f9;display:inline-block;animation:typingBounce 1.4s infinite ease-in-out both; }
        @keyframes typingBounce { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        .chat-stream-cursor { display:inline-block;color:#22d3ee;animation:cursorBlink 0.9s step-end infinite;margin-left:1px; }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Right Parameters Rail */
        .cfab-rail-right {
          width: 0; overflow: hidden; flex-shrink: 0;
          display: flex; flex-direction: column;
          background: rgba(6,6,18,0.72);
          border-left: 0px solid var(--border-light);
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1), border-left-width 0.1s ease;
        }
        .cfab-rail-right--open {
          width: 150px;
          border-left-width: 1px;
        }
        .cfab-params-content {
          flex: 1; overflow-y: auto; padding: 10px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .cfab-params-content::-webkit-scrollbar { width: 3px; }
        .cfab-params-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }
        
        .cfab-param-section {
          display: flex; flex-direction: column; gap: 4px;
        }
        .cfab-param-title {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        
        /* Preset cards list */
        .cfab-preset-list {
          display: flex; flex-direction: column; gap: 4px;
        }
        .cfab-preset-card {
          padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);
          background: rgba(255,255,255,0.01); cursor: pointer;
          transition: all 0.15s ease; width: 100%; outline: none;
        }
        .cfab-preset-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
        }
        .cfab-preset-card--active {
          background: rgba(34,211,238,0.08) !important;
          border-color: rgba(34,211,238,0.3) !important;
        }
        
        /* Range slider style */
        .cfab-slider {
          -webkit-appearance: none; width: 100%; height: 4px;
          border-radius: 2px; background: rgba(255,255,255,0.15);
          outline: none; transition: background 0.15s ease;
        }
        .cfab-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 12px; height: 12px; border-radius: 50%;
          background: #22d3ee; cursor: pointer;
          box-shadow: 0 0 6px rgba(34,211,238,0.8);
          transition: transform 0.15s ease;
        }
        .cfab-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        
        /* Mic/Voice Input button */
        .cfab-mic-btn {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          background: var(--bg-surface); border: 1px solid var(--border-light);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-secondary); outline: none;
          transition: all 0.2s ease;
        }
        .cfab-mic-btn:hover {
          background: var(--bg-hover); color: var(--text-primary);
        }
        .cfab-mic-btn--active {
          background: rgba(239,68,68,0.15) !important;
          border-color: rgba(239,68,68,0.4) !important;
          color: #ef4444 !important;
          animation: mic-pulse 1.4s infinite ease-in-out;
        }
        @keyframes mic-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.96); }
        }
        
        /* Doc tag workspace badge */
        .cfab-doc-badge {
          background: rgba(245,158,11,0.06);
          border: 1px solid rgba(245,158,11,0.22);
          border-radius: 8px; padding: 6px 8px;
          font-size: 10px; color: var(--text-primary);
          line-height: 1.3;
        }

        @media (max-width:600px) {
          .chat-floating-wrapper { bottom:24px !important; right:20px !important; }
          .chat-floating-window, .chat-window-expanded {
            position:fixed !important; bottom:88px !important; right:16px !important; left:16px !important;
            width:auto !important; height:calc(100dvh - 110px) !important; max-height:100% !important;
            box-shadow:0 16px 48px rgba(0,0,0,0.85) !important; border-radius:18px !important;
          }
        }
      `}</style>
    </div>
  );
}
