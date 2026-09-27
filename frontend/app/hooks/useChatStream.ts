import { useState, useEffect, useRef, useCallback } from "react";
import { showToast } from "../components/Toast";
import { API_BASE_URL } from "../config";
import { PRESETS } from "../components/ChatAssistant";
import { getLocalFileText, getLocalFileBlob, storeLocalFileText } from "../lib/idb";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResearchStep {
  id: string;
  label: string;
  tool?: string;
  status: "pending" | "running" | "completed";
  details?: string;
}

export interface ResearchPlan {
  title: string;
  steps: ResearchStep[];
}

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
  researchPlan?: ResearchPlan;
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

// ── Guest localStorage helpers ─────────────────────────────────────────────────
//
// All guest data lives in localStorage under namespaced keys.
// Nothing is ever written to the backend database for guest sessions.
// Threads are capped at MAX_GUEST_THREADS and pruned oldest-first.

const MAX_GUEST_THREADS = 10;
const GUEST_THREADS_KEY = "ak_guest_threads";
const GUEST_MSGS_PREFIX = "ak_guest_msgs_";

function loadGuestThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        t.id !== "thread-welcome" &&
        t.title !== "Market & Knowledge Intelligence",
    );
  } catch {
    return [];
  }
}

function saveGuestThreads(threads: ChatThread[]): void {
  if (typeof window === "undefined") return;
  // Prune to cap: keep the most-recently-updated MAX_GUEST_THREADS threads
  const pruned = [...threads]
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    .slice(0, MAX_GUEST_THREADS);
  // Clean up orphaned message stores for pruned threads
  const keptIds = new Set(pruned.map((t) => t.id));
  threads.forEach((t) => {
    if (!keptIds.has(t.id)) localStorage.removeItem(GUEST_MSGS_PREFIX + t.id);
  });
  localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(pruned));
}

function loadGuestMessages(threadId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_MSGS_PREFIX + threadId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestMessages(threadId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_MSGS_PREFIX + threadId, JSON.stringify(messages));
}

function generateGuestId(): string {
  return "guest_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Document Workspace Chat Persistence Helpers ──────────────────────────────
const DOC_MSGS_PREFIX = "ak_doc_msgs_";

export function getSafeDocumentKey(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

export function loadDocumentMessages(username: string, filename: string): ChatMessage[] {
  if (typeof window === "undefined" || !filename) return [];
  try {
    const safeUser = username || "user";
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${getSafeDocumentKey(filename)}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDocumentMessages(
  username: string,
  filename: string,
  messages: ChatMessage[]
): void {
  if (typeof window === "undefined" || !filename) return;
  try {
    const safeUser = username || "user";
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${getSafeDocumentKey(filename)}`;
    localStorage.setItem(key, JSON.stringify(messages));
  } catch {}
}

export function clearDocumentMessages(username: string, filename: string): void {
  if (typeof window === "undefined" || !filename) return;
  try {
    const safeUser = username || "user";
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${getSafeDocumentKey(filename)}`;
    localStorage.removeItem(key);
  } catch {}
}


export function useChatStream({
  username,
  activeDocumentFilename,
  selectedModel,
  setSelectedModel,
  activePreset,
  temperature,
}: UseChatStreamProps) {
  const isGuest = !username || username === "guest";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track latest messages in a ref so the streaming finally-block can read them
  const latestMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  const welcomeMessage = useCallback((): ChatMessage => ({
    role: "ai",
    content: activeDocumentFilename
      ? `📄 **Document Workspace Ready**\n\nI'm analysing **${activeDocumentFilename}** for you. Ask me anything about this document — I'll search it and give you precise, cited answers.`
      : isGuest
      ? "Hi! I'm your **AI Knowledge Worker**. You're browsing as a **Guest** — your conversations are saved in this browser only and won't sync across devices. Sign in to save history permanently.\n\nWhat can I help you with today?"
      : "Hi! I'm your AI Knowledge Worker. I can help you analyze news, check stock data, summarize documents, and answer questions. What can I do for you today?",
  }), [activeDocumentFilename, isGuest]);

  // ── Thread loading ────────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    if (isGuest) {
      // Guest: read entirely from localStorage — zero network calls
      const guestList = loadGuestThreads();
      saveGuestThreads(guestList);
      setThreads(guestList);
      return;
    }
    // Authenticated: fetch from backend API
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/threads?username=${encodeURIComponent(username)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        const validThreads = Array.isArray(data)
          ? data.filter(
              (t: any) =>
                t &&
                t.id !== "thread-welcome" &&
                t.title !== "Market & Knowledge Intelligence",
            )
          : [];
        setThreads(validThreads);
      }
    } catch { /* silent */ }
  }, [username, isGuest]);

  useEffect(() => {
    fetchThreads();
    if (activeDocumentFilename) {
      const savedDocMsgs = loadDocumentMessages(username, activeDocumentFilename);
      if (savedDocMsgs && savedDocMsgs.length > 0) {
        setMessages(savedDocMsgs);
        setActiveThreadId(`doc-thread-${username}-${getSafeDocumentKey(activeDocumentFilename)}`);
        return;
      }
    }
    setMessages([welcomeMessage()]);
  }, [fetchThreads, activeDocumentFilename, username, welcomeMessage]);

  // Restore messages when activeDocumentFilename changes
  useEffect(() => {
    if (activeDocumentFilename) {
      const savedDocMsgs = loadDocumentMessages(username, activeDocumentFilename);
      if (savedDocMsgs && savedDocMsgs.length > 0) {
        setMessages(savedDocMsgs);
        setActiveThreadId(`doc-thread-${username}-${getSafeDocumentKey(activeDocumentFilename)}`);
      } else {
        setMessages([welcomeMessage()]);
      }
    }
  }, [activeDocumentFilename, username, welcomeMessage]);

  // Command palette events
  useEffect(() => {
    const handleNewChat = () => startNewChat();
    const handleClearChat = () => {
      if (activeDocumentFilename) {
        clearDocumentMessages(username, activeDocumentFilename);
      }
      setMessages([welcomeMessage()]);
    };
    window.addEventListener("ak-new-chat", handleNewChat);
    window.addEventListener("ak-clear-chat", handleClearChat);
    return () => {
      window.removeEventListener("ak-new-chat", handleNewChat);
      window.removeEventListener("ak-clear-chat", handleClearChat);
    };
  }, [activeDocumentFilename, username, welcomeMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Thread CRUD ───────────────────────────────────────────────────────────────

  const createThread = async (firstMessage?: string): Promise<string | null> => {
    const title = activeDocumentFilename
      ? `📄 ${activeDocumentFilename}`
      : firstMessage
      ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "…" : "")
      : "New Chat";
    const now = new Date().toISOString();

    if (activeDocumentFilename) {
      const docThreadId = `doc-thread-${username}-${getSafeDocumentKey(activeDocumentFilename)}`;
      const thread: ChatThread = {
        id: docThreadId,
        username,
        title,
        model: selectedModel,
        created_at: now,
        updated_at: now,
      };
      const guestThreads = loadGuestThreads();
      const updated = [thread, ...guestThreads.filter((t) => t.id !== docThreadId)];
      saveGuestThreads(updated);
      setThreads(updated.slice(0, MAX_GUEST_THREADS));
      setActiveThreadId(docThreadId);

      try {
        await fetch(`${API_BASE_URL}/chat/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: docThreadId, username, title, model: selectedModel }),
        });
      } catch {}

      return docThreadId;
    }

    if (isGuest) {
      // Guest: create thread in localStorage only — no backend call
      const threadId = generateGuestId();
      const thread: ChatThread = {
        id: threadId,
        username: "guest",
        title,
        model: selectedModel,
        created_at: now,
        updated_at: now,
      };
      const updated = [thread, ...loadGuestThreads()];
      saveGuestThreads(updated);
      setThreads(updated.slice(0, MAX_GUEST_THREADS));
      setActiveThreadId(threadId);
      return threadId;
    }

    // Authenticated: create via backend API
    try {
      const res = await fetch(`${API_BASE_URL}/chat/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, title, model: selectedModel }),
      });
      if (res.ok) {
        const thread = await res.json();
        setThreads((prev) => [thread, ...prev]);
        setActiveThreadId(thread.id);
        return thread.id as string;
      }
    } catch { /* silent */ }

    // Fallback if backend is offline
    const threadId = generateGuestId();
    const thread: ChatThread = {
      id: threadId,
      username,
      title,
      model: selectedModel,
      created_at: now,
      updated_at: now,
    };
    const updated = [thread, ...loadGuestThreads()];
    saveGuestThreads(updated);
    setThreads(updated.slice(0, MAX_GUEST_THREADS));
    setActiveThreadId(threadId);
    return threadId;
  };

  const switchThread = async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);

    // If it's a document thread
    if (threadId.startsWith("doc-thread-")) {
      const msgs = loadGuestMessages(threadId);
      if (msgs.length > 0) {
        setMessages(msgs);
        return;
      }
    }

    if (isGuest) {
      // Guest: load messages from localStorage
      const msgs = loadGuestMessages(threadId);
      setMessages(msgs.length > 0 ? msgs : [welcomeMessage()]);
      return;
    }

    // Authenticated: load messages from backend API with localStorage fallback
    try {
      const res = await fetch(
        `${API_BASE_URL}/chat/threads/${threadId}/messages`,
        { credentials: "include" }
      );
      if (res.ok) {
        const msgs = await res.json();
        if (msgs.length === 0) {
          const localFallback = loadGuestMessages(threadId);
          setMessages(localFallback.length > 0 ? localFallback : [welcomeMessage()]);
        } else {
          setMessages(msgs.map((m: any) => ({
            role: m.role as "user" | "ai",
            content: m.content,
            thinkingLogs: m.thinking_logs || undefined,
            toolLogs: m.tool_logs || undefined,
            model: m.model || undefined,
          })));
        }
      } else {
        const localFallback = loadGuestMessages(threadId);
        setMessages(localFallback.length > 0 ? localFallback : [welcomeMessage()]);
      }
    } catch {
      const localFallback = loadGuestMessages(threadId);
      setMessages(localFallback.length > 0 ? localFallback : [welcomeMessage()]);
    }
  };

  const renameThread = async (threadId: string, title: string) => {
    if (isGuest) {
      // Guest: rename in localStorage
      const updated = loadGuestThreads().map((t) =>
        t.id === threadId ? { ...t, title, updated_at: new Date().toISOString() } : t
      );
      saveGuestThreads(updated);
      setThreads(updated);
      return;
    }
    // Authenticated: rename via backend API
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
    if (isGuest || threadId.startsWith("doc-thread-")) {
      // Guest or doc-thread: remove from localStorage
      localStorage.removeItem(GUEST_MSGS_PREFIX + threadId);
      const updated = loadGuestThreads().filter((t) => t.id !== threadId);
      saveGuestThreads(updated);
      setThreads(updated.slice(0, MAX_GUEST_THREADS));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([welcomeMessage()]);
      }
      return;
    }
    // Authenticated: delete via backend API
    try {
      await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([welcomeMessage()]);
      }
    } catch { /* silent */ }
  };

  const startNewChat = () => {
    if (activeDocumentFilename) {
      clearDocumentMessages(username, activeDocumentFilename);
    }
    setActiveThreadId(null);
    setMessages([welcomeMessage()]);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // ── sendMessage ───────────────────────────────────────────────────────────────

  const sendMessage = async (inputVal: string, onClearInput?: () => void) => {
    const userMessage = inputVal.trim();
    if (!userMessage || loading) return;

    if (onClearInput) onClearInput();
    setStreamingStatus("");

    let threadId = activeThreadId;
    if (!threadId) threadId = await createThread(userMessage);
    if (!threadId) {
      showToast("error", "Failed to initialize conversation thread.");
      return;
    }

    const chatHistory = messages
      .filter((m) => m.content !== welcomeMessage().content)
      .map((msg) => ({ role: msg.role === "ai" ? "ai" : "user", content: msg.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage } as ChatMessage,
      {
        role: "ai",
        content: "",
        model: selectedModel === "llama-70b" ? "Groq (Ultra-Fast)" : "Google Gemini 2.5",
      } as ChatMessage,
    ]);
    setLoading(true);

    const completeAllResearchSteps = () => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "ai" && last.researchPlan) {
          const allCompleted = last.researchPlan.steps.map((s) => ({
            ...s,
            status: "completed" as const,
          }));
          updated[updated.length - 1] = {
            ...last,
            researchPlan: {
              ...last.researchPlan,
              steps: allCompleted,
            },
          };
        }
        return updated;
      });
    };

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const docToSend =
        activeDocumentFilename ||
        (typeof window !== "undefined"
          ? localStorage.getItem("ak_active_file")
          : null);

      let documentContentToSend: string | null = null;
      if (docToSend) {
        try {
          // 1. Check IndexedDB text store
          documentContentToSend = await getLocalFileText(docToSend);

          // 2. Check localStorage uploads cache
          if (!documentContentToSend && typeof window !== "undefined") {
            const rawCache = localStorage.getItem("ak_uploads_list_cache");
            if (rawCache) {
              const list = JSON.parse(rawCache);
              const found = list.find(
                (u: any) =>
                  u.filename === docToSend ||
                  u.filename?.toLowerCase() === docToSend.toLowerCase()
              );
              if (found?.content && found.content.length > 20) {
                documentContentToSend = found.content;
                storeLocalFileText(docToSend, found.content);
              }
            }
          }

          // 3. If still empty, extract on-the-fly from IndexedDB binary Blob via PDF.js
          if (!documentContentToSend && typeof window !== "undefined") {
            const blob = await getLocalFileBlob(docToSend);
            const pdfjsLib = (window as any).pdfjsLib;
            if (blob && pdfjsLib) {
              const arrayBuf = await blob.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
              const pages: string[] = [];
              for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
                const page = await pdf.getPage(i);
                const tc = await page.getTextContent();
                const pageText = tc.items.map((it: any) => it.str).join(" ");
                pages.push(`[Page ${i}]\n${pageText}`);
              }
              const extracted = pages.join("\n\n").trim();
              if (extracted.length > 20) {
                documentContentToSend = extracted;
                storeLocalFileText(docToSend, extracted);
              }
            }
          }
        } catch (docErr) {
          console.warn("Client document text resolution note:", docErr);
        }
      }

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
          ...(docToSend ? { filename: docToSend } : {}),
          ...(documentContentToSend ? { document_content: documentContentToSend } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        if (res.status === 429) {
          const errData = await res.json().catch(() => null);
          const throttleMsg =
            errData?.message ||
            errData?.detail ||
            "Rate limit reached: An AI response is already generating or request limit exceeded. Please wait a few moments.";
          showToast("warning", throttleMsg);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "ai") {
              updated[updated.length - 1] = {
                ...last,
                content: `⏳ **Request Throttled:** ${throttleMsg}`,
              };
            }
            return updated;
          });
          setStreamingStatus("");
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // ── Research Plan Tracking ─────────────────────────────────────────────
      // Buffer streamed tokens to detect <research_plan title="...">steps</research_plan>
      let tokenBuffer = "";
      let planParsed  = false;
      // Tracks which step index the next tool execution maps to
      const stepIndexRef = { current: 0 };

      const parseResearchPlan = (raw: string): ResearchPlan | null => {
        const match = raw.match(/<research_plan\s+title="([^"]+)">([^<\n]+)(?:<\/research_plan>)?/);
        if (!match) return null;
        const title = match[1].trim();
        const stepLabels = match[2].split("||").map((s) => s.trim()).filter(Boolean);
        if (stepLabels.length === 0) return null;
        const steps: ResearchStep[] = stepLabels.map((label, i) => ({
          id: `step-${i}`,
          label,
          status: "pending",
        }));
        return { title, steps };
      };

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
            completeAllResearchSteps();
            break;
          }

          try {
            let event: { type: string; content: string };
            if (payload.startsWith("{")) {
              event = JSON.parse(payload) as { type: string; content: string };
            } else {
              event = { type: "token", content: payload };
            }

            if (event.type === "token") {
              // ── Accumulate tokens for research plan detection ──────────────
              if (!planParsed) {
                tokenBuffer += event.content;
                // Check if we hit the closing tag, a newline, or the next artifact/content block
                const hasClosing = tokenBuffer.includes("</research_plan>");
                const hasNextBlock = tokenBuffer.includes("<artifact") || (tokenBuffer.includes("<research_plan") && tokenBuffer.includes("\n"));
                if (hasClosing || hasNextBlock) {
                  const plan = parseResearchPlan(tokenBuffer);
                  if (plan) {
                    planParsed = true;
                    stepIndexRef.current = 0;
                    setMessages((prev) => {
                      const updated = [...prev];
                      const last = updated[updated.length - 1];
                      if (last && last.role === "ai") {
                        // Strip the research_plan tag from visible content
                        const cleanContent = last.content
                          .replace(/<research_plan[^>]*>[^<\n]*(?:<\/research_plan>)?/g, "")
                          .trimStart();
                        updated[updated.length - 1] = { ...last, content: cleanContent, researchPlan: plan };
                      }
                      return updated;
                    });
                    // Don't display the plan tag itself as content
                    continue;
                  }
                }
                // Only skip displaying tokens that are inside the plan tag
                if (tokenBuffer.includes("<research_plan") && !tokenBuffer.includes("</research_plan>") && !tokenBuffer.includes("\n")) {
                  continue; // Still buffering the plan tag
                }
              }

              // Normal token — append to displayed content (strip any plan tag remnants)
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  const safeToken = event.content.replace(/<research_plan[^>]*>|<\/research_plan>/g, "");
                  updated[updated.length - 1] = { ...last, content: last.content + safeToken };
                }
                return updated;
              });

            } else if (event.type === "model_used") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = { ...last, model: event.content };
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
                  if (!logs.includes(event.content)) logs.push(event.content);
                  updated[updated.length - 1] = { ...last, thinkingLogs: logs };
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
                    // Update tool logs
                    const tools = last.toolLogs ? [...last.toolLogs] : [];
                    if (!tools.some((t) => t.id === startData.id)) {
                      tools.push({ id: startData.id, name: startData.name, arguments: startData.arguments, status: "executing" });
                    }
                    // Advance research plan step to "running"
                    let updatedPlan = last.researchPlan;
                    if (updatedPlan) {
                      const idx = stepIndexRef.current;
                      if (idx < updatedPlan.steps.length) {
                        updatedPlan = {
                          ...updatedPlan,
                          steps: updatedPlan.steps.map((s, i) =>
                            i === idx ? { ...s, status: "running", tool: startData.name } : s
                          ),
                        };
                      }
                    }
                    updated[updated.length - 1] = { ...last, toolLogs: tools, researchPlan: updatedPlan };
                  }
                  return updated;
                });
              } catch (e) { console.error("Failed to parse tool_start SSE event", e); }

            } else if (event.type === "tool_end") {
              try {
                const endData = JSON.parse(event.content) as { id: string; name: string; status: "success" | "error"; output?: string };
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "ai") {
                    // Update tool logs
                    const tools = last.toolLogs
                      ? last.toolLogs.map((t) => t.id === endData.id ? { ...t, status: endData.status, output: endData.output } : t)
                      : [];
                    // Advance research plan step to "completed"
                    let updatedPlan = last.researchPlan;
                    if (updatedPlan) {
                      const idx = stepIndexRef.current;
                      if (idx < updatedPlan.steps.length) {
                        const snippet = endData.output ? endData.output.slice(0, 300) : undefined;
                        updatedPlan = {
                          ...updatedPlan,
                          steps: updatedPlan.steps.map((s, i) =>
                            i === idx ? { ...s, status: "completed", details: snippet } : s
                          ),
                        };
                        stepIndexRef.current = idx + 1; // Advance to next step
                      }
                    }
                    updated[updated.length - 1] = { ...last, toolLogs: tools, researchPlan: updatedPlan };
                  }
                  return updated;
                });
              } catch (e) { console.error("Failed to parse tool_end SSE event", e); }

            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = { ...last, content: event.content };
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
      completeAllResearchSteps();
      setLoading(false);
      setStreamingStatus("");
      abortControllerRef.current = null;

      const finalMessages = latestMessagesRef.current;

      // ── Always persist document workspace messages ──
      if (activeDocumentFilename && finalMessages && finalMessages.length > 0) {
        saveDocumentMessages(username, activeDocumentFilename, finalMessages);
      }

      // ── Always persist messages to thread cache ──
      if (threadId && finalMessages && finalMessages.length > 0) {
        saveGuestMessages(threadId, finalMessages);
      }

      if (threadId) {
        // Bump the thread's updated_at to the top of the list
        const guestThreads = loadGuestThreads();
        const updatedThreads = guestThreads.map((t) =>
          t.id === threadId ? { ...t, updated_at: new Date().toISOString() } : t
        );
        saveGuestThreads(updatedThreads);
        setThreads(updatedThreads.slice(0, MAX_GUEST_THREADS));
      }

      if (!isGuest) {
        fetchThreads();
      }
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

