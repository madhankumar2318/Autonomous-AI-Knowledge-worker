import { useState, useEffect, useRef, useCallback } from "react";
import { showToast } from "../components/Toast";
import { API_BASE_URL } from "../config";
import { PRESETS } from "../components/ChatAssistant";

export interface ChatMessage {
  role: "user" | "ai";
  content: string;
  thinkingLogs?: string[];
  toolLogs?: {
    id: string;
    name: string;
    arguments?: string;
    status: "executing" | "success" | "error";
    output?: string;
  }[];
  model?: string;
}

export interface ChatThread {
  id: string;
  username: string;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

interface UseChatStreamProps {
  username: string;
  activeDocumentFilename: string | null;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  activePreset: keyof typeof PRESETS;
  temperature: number;
}

export function useChatStream({
  username,
  activeDocumentFilename,
  selectedModel,
  setSelectedModel,
  activePreset,
  temperature,
}: UseChatStreamProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const welcomeMessage = useCallback((): ChatMessage => ({
    role: "ai",
    content: activeDocumentFilename
      ? `📄 **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document — I'll search it and give you precise, cited answers.`
      : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
  }), [activeDocumentFilename]);

  // Fetch all threads on mount
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads?username=${encodeURIComponent(username)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setThreads(data);
        } else {
          setThreads([]);
        }
      }
    } catch { /* silent */ }
  }, [username]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Reset messages when activeDocumentFilename changes
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([welcomeMessage()]);
    }
  }, [activeDocumentFilename, activeThreadId, welcomeMessage]);

  // Subscribe to command palette event actions
  useEffect(() => {
    const handleNewChat = () => {
      startNewChat();
    };
    const handleClearChat = () => {
      setMessages([welcomeMessage()]);
    };
    window.addEventListener("ak-new-chat", handleNewChat);
    window.addEventListener("ak-clear-chat", handleClearChat);
    return () => {
      window.removeEventListener("ak-new-chat", handleNewChat);
      window.removeEventListener("ak-clear-chat", handleClearChat);
    };
  }, [welcomeMessage]);

  const createThread = async (firstMessage?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          title: firstMessage ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "") : "New Chat",
          model: selectedModel,
        }),
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
          setMessages(msgs.map((m: any) => ({
            role: m.role as "user" | "ai",
            content: m.content,
            thinkingLogs: m.thinking_logs || undefined,
            toolLogs: m.tool_logs || undefined,
            model: m.model || undefined,
          })));
        }
      }
    } catch {
      setMessages([welcomeMessage()]);
    }
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

  const startNewChat = async () => {
    setActiveThreadId(null);
    setMessages([welcomeMessage()]);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async (inputVal: string, onClearInput?: () => void) => {
    const userMessage = inputVal.trim();
    if (!userMessage || loading) return;

    if (onClearInput) onClearInput();
    setStreamingStatus("");

    let threadId = activeThreadId;
    if (!threadId) {
      threadId = await createThread(userMessage);
    }
    if (!threadId) {
      showToast("error", "Failed to initialize conversation thread.");
      return;
    }

    const chatHistory = messages
      .filter((m) => m.content !== welcomeMessage().content)
      .map((msg) => ({
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

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
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
      fetchThreads();
    }
  };

  return {
    messages,
    threads,
    activeThreadId,
    loading,
    streamingStatus,
    fetchThreads,
    switchThread,
    renameThread,
    deleteThread,
    startNewChat,
    sendMessage,
    stopGeneration,
    welcomeMessage,
  };
}
