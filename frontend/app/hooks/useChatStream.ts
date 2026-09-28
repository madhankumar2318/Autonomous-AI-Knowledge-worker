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

// ── Universal Chat & Thread Local Persistence ───────────────────────────────
//
// Persistent, instantaneous client-side thread & message caching for all users
// (guest, admin, custom users) with zero-data-loss synchronization.
// Threads are capped at MAX_THREADS (50) and pruned oldest-first.

const MAX_THREADS = 50;
const THREADS_PREFIX = "ak_threads_";
const MSGS_PREFIX = "ak_msgs_";
const GUEST_THREADS_KEY = "ak_guest_threads";
const GUEST_MSGS_PREFIX = "ak_guest_msgs_";
const DOC_MSGS_PREFIX = "ak_doc_msgs_";

export function getSafeDocumentKey(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function getUserThreadsKey(username: string): string {
  const safe = (username || "guest").toLowerCase().trim();
  return `${THREADS_PREFIX}${safe}`;
}

export function loadThreadMessages(threadId: string): ChatMessage[] {
  if (typeof window === "undefined" || !threadId) return [];
  try {
    let raw = localStorage.getItem(MSGS_PREFIX + threadId);
    if (!raw) {
      raw = localStorage.getItem(GUEST_MSGS_PREFIX + threadId);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export const loadGuestMessages = loadThreadMessages;

export function saveThreadMessages(threadId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined" || !threadId) return;
  try {
    const payload = JSON.stringify(messages);
    localStorage.setItem(MSGS_PREFIX + threadId, payload);
    localStorage.setItem(GUEST_MSGS_PREFIX + threadId, payload);
  } catch {}
}
export const saveGuestMessages = saveThreadMessages;

export function removeThreadMessages(threadId: string): void {
  if (typeof window === "undefined" || !threadId) return;
  try {
    localStorage.removeItem(MSGS_PREFIX + threadId);
    localStorage.removeItem(GUEST_MSGS_PREFIX + threadId);
  } catch {}
}

export function loadDocumentMessages(username: string, filename: string): ChatMessage[] {
  if (typeof window === "undefined" || !filename) return [];
  try {
    const safeUser = (username || "guest").toLowerCase().trim();
    const docKey = getSafeDocumentKey(filename);
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${docKey}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const docThreadId = `doc-thread-${safeUser}-${docKey}`;
    const fromThread = loadThreadMessages(docThreadId);
    if (fromThread && fromThread.length > 0) return fromThread;
    return [];
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
    const safeUser = (username || "guest").toLowerCase().trim();
    const docKey = getSafeDocumentKey(filename);
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${docKey}`;
    const payload = JSON.stringify(messages);
    localStorage.setItem(key, payload);

    const docThreadId = `doc-thread-${safeUser}-${docKey}`;
    saveThreadMessages(docThreadId, messages);
  } catch {}
}

export function clearDocumentMessages(username: string, filename: string): void {
  if (typeof window === "undefined" || !filename) return;
  try {
    const safeUser = (username || "guest").toLowerCase().trim();
    const docKey = getSafeDocumentKey(filename);
    const key = `${DOC_MSGS_PREFIX}${safeUser}_${docKey}`;
    localStorage.removeItem(key);

    const docThreadId = `doc-thread-${safeUser}-${docKey}`;
    removeThreadMessages(docThreadId);
  } catch {}
}

function scanDocumentThreads(username: string): ChatThread[] {
  if (typeof window === "undefined") return [];
  const safeUser = (username || "guest").toLowerCase().trim();
  const prefix = `${DOC_MSGS_PREFIX}${safeUser}_`;
  const found: ChatThread[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const msgs = JSON.parse(raw);
            if (Array.isArray(msgs) && msgs.length > 0) {
              const docKey = k.slice(prefix.length);
              const threadId = `doc-thread-${safeUser}-${docKey}`;
              let title = `📄 ${docKey}`;
              const firstAi = msgs.find((m: any) => m.role === "ai" && m.content);
              if (firstAi) {
                const match = firstAi.content.match(/([a-zA-Z0-9_\-.]+\.pdf)/i);
                if (match) title = `📄 ${match[1]}`;
              }
              const now = new Date().toISOString();
              found.push({
                id: threadId,
                username: username || "guest",
                title,
                model: "gemini-flash",
                created_at: now,
                updated_at: now,
              });
            }
          } catch {}
        }
      }
    }
  } catch {}
  return found;
}

export function loadUserThreads(username: string): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getUserThreadsKey(username);
    let threads: ChatThread[] = [];
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          threads = parsed.filter(
            (t) =>
              t &&
              t.id !== "thread-welcome" &&
              t.title !== "Market & Knowledge Intelligence",
          );
        }
      } catch {}
    }

    // Fallback: check legacy guest store
    if (threads.length === 0) {
      const guestRaw = localStorage.getItem(GUEST_THREADS_KEY);
      if (guestRaw) {
        try {
          const parsedGuest = JSON.parse(guestRaw);
          if (Array.isArray(parsedGuest) && parsedGuest.length > 0) {
            threads = parsedGuest.filter(
              (t) =>
                t &&
                t.id !== "thread-welcome" &&
                t.title !== "Market & Knowledge Intelligence",
            );
          }
        } catch {}
      }
    }

    // Merge in any scanned document threads if missing
    const docThreads = scanDocumentThreads(username);
    for (const dt of docThreads) {
      if (!threads.some((t) => t.id === dt.id)) {
        threads.unshift(dt);
      }
    }

    return threads;
  } catch {
    return [];
  }
}
export const loadGuestThreads = () => loadUserThreads("guest");

export function saveUserThreads(username: string, threads: ChatThread[]): void {
  if (typeof window === "undefined") return;
  try {
    const key = getUserThreadsKey(username);
    const pruned = [...threads]
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
      .slice(0, MAX_THREADS);
    localStorage.setItem(key, JSON.stringify(pruned));

    if (!username || username === "guest") {
      localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(pruned));
    }
  } catch {}
}
export const saveGuestThreads = (threads: ChatThread[]) => saveUserThreads("guest", threads);

function generateId(): string {
  return "thread_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export const generateGuestId = generateId;



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

  // ── Thread loading ────────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    // 1. Immediately load local threads so sidebar is never blank
    const localList = loadUserThreads(username);
    setThreads(localList);

    // 2. If authenticated, fetch from backend API and MERGE (never wipe out local threads)
    if (!isGuest) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/chat/threads?username=${encodeURIComponent(username)}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const remoteList = await res.json();
          if (Array.isArray(remoteList) && remoteList.length > 0) {
            const validRemote = remoteList.filter(
              (t: any) =>
                t &&
                t.id !== "thread-welcome" &&
                t.title !== "Market & Knowledge Intelligence",
            );
            // Combine remote with local, local taking priority
            const map = new Map<string, ChatThread>();
            validRemote.forEach((t: ChatThread) => map.set(t.id, t));
            localList.forEach((t: ChatThread) => map.set(t.id, t));
            const merged = Array.from(map.values()).sort(
              (a, b) => (b.updated_at > a.updated_at ? 1 : -1)
            );
            saveUserThreads(username, merged);
            setThreads(merged);
          }
        }
      } catch { /* silent */ }
    }
  }, [username, isGuest]);

  useEffect(() => {
    fetchThreads();

    if (activeDocumentFilename) {
      const safeUser = (username || "guest").toLowerCase().trim();
      const safeDocKey = getSafeDocumentKey(activeDocumentFilename);
      const docThreadId = `doc-thread-${safeUser}-${safeDocKey}`;
      const savedDocMsgs = loadDocumentMessages(username, activeDocumentFilename);

      if (savedDocMsgs && savedDocMsgs.length > 0) {
        setMessages(savedDocMsgs);
        setActiveThreadId(docThreadId);

        // Ensure this document thread is in the threads list
        const existing = loadUserThreads(username);
        if (!existing.some((t) => t.id === docThreadId)) {
          const docThread: ChatThread = {
            id: docThreadId,
            username: username || "guest",
            title: `📄 ${activeDocumentFilename}`,
            model: selectedModel,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const updated = [docThread, ...existing];
          saveUserThreads(username, updated);
          setThreads(updated);
        }
        return;
      }
    }

    setMessages([welcomeMessage()]);
  }, [fetchThreads, activeDocumentFilename, username, welcomeMessage, selectedModel]);

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

    const safeUser = (username || "guest").toLowerCase().trim();
    const threadId = activeDocumentFilename
      ? `doc-thread-${safeUser}-${getSafeDocumentKey(activeDocumentFilename)}`
      : generateId();

    const thread: ChatThread = {
      id: threadId,
      username: username || "guest",
      title,
      model: selectedModel,
      created_at: now,
      updated_at: now,
    };

    const currentThreads = loadUserThreads(username);
    const updated = [thread, ...currentThreads.filter((t) => t.id !== threadId)];
    saveUserThreads(username, updated);
    setThreads(updated);
    setActiveThreadId(threadId);

    // Sync with backend API in background if authenticated
    if (!isGuest) {
      try {
        await fetch(`${API_BASE_URL}/chat/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: threadId, username, title, model: selectedModel }),
        });
      } catch {}
    }

    return threadId;
  };

  const switchThread = async (threadId: string) => {
    if (threadId === activeThreadId) return;
    setActiveThreadId(threadId);

    // 1. If it's a document thread
    if (threadId.startsWith("doc-thread-")) {
      const msgs = loadThreadMessages(threadId);
      if (msgs.length > 0) {
        setMessages(msgs);
        return;
      }
      if (activeDocumentFilename) {
        const docMsgs = loadDocumentMessages(username, activeDocumentFilename);
        if (docMsgs.length > 0) {
          setMessages(docMsgs);
          return;
        }
      }
    }

    // 2. Load from local thread messages
    const localMsgs = loadThreadMessages(threadId);
    if (localMsgs.length > 0) {
      setMessages(localMsgs);
      return;
    }

    // 3. Fallback to backend API if authenticated
    if (!isGuest) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/chat/threads/${threadId}/messages`,
          { credentials: "include" }
        );
        if (res.ok) {
          const msgs = await res.json();
          if (Array.isArray(msgs) && msgs.length > 0) {
            const formatted: ChatMessage[] = msgs.map((m: any) => ({
              role: (m.role === "assistant" ? "ai" : m.role) as "user" | "ai",
              content: m.content,
              thinkingLogs: m.thinking_logs || undefined,
              toolLogs: m.tool_logs || undefined,
              model: m.model || undefined,
            }));
            saveThreadMessages(threadId, formatted);
            setMessages(formatted);
            return;
          }
        }
      } catch {}
    }

    setMessages([welcomeMessage()]);
  };

  const renameThread = async (threadId: string, title: string) => {
    if (!title.trim()) return;
    const cleanTitle = title.trim();

    const updated = loadUserThreads(username).map((t) =>
      t.id === threadId ? { ...t, title: cleanTitle, updated_at: new Date().toISOString() } : t
    );
    saveUserThreads(username, updated);
    setThreads(updated);

    if (!isGuest) {
      try {
        await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: cleanTitle }),
        });
      } catch {}
    }
  };

  const deleteThread = async (threadId: string) => {
    removeThreadMessages(threadId);
    if (threadId.startsWith("doc-thread-") && activeDocumentFilename) {
      clearDocumentMessages(username, activeDocumentFilename);
    }
    const updated = loadUserThreads(username).filter((t) => t.id !== threadId);
    saveUserThreads(username, updated);
    setThreads(updated);

    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setMessages([welcomeMessage()]);
    }

    if (!isGuest) {
      try {
        await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {}
    }
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

      // ── 1. Always persist document workspace messages ──
      if (activeDocumentFilename && finalMessages && finalMessages.length > 0) {
        saveDocumentMessages(username, activeDocumentFilename, finalMessages);
      }

      // ── 2. Always persist messages to thread cache ──
      if (threadId && finalMessages && finalMessages.length > 0) {
        saveThreadMessages(threadId, finalMessages);
      }

      // ── 3. Update thread's updated_at timestamp & auto-title in user threads ──
      if (threadId) {
        const curThreads = loadUserThreads(username);
        let found = false;
        const updatedThreads = curThreads.map((t) => {
          if (t.id === threadId) {
            found = true;
            let updatedTitle = t.title;
            if ((!updatedTitle || updatedTitle === "New Chat") && !activeDocumentFilename && userMessage) {
              updatedTitle = userMessage.slice(0, 50) + (userMessage.length > 50 ? "…" : "");
            }
            return {
              ...t,
              title: updatedTitle,
              updated_at: new Date().toISOString(),
            };
          }
          return t;
        });

        if (!found) {
          const newThread: ChatThread = {
            id: threadId,
            username: username || "guest",
            title: activeDocumentFilename
              ? `📄 ${activeDocumentFilename}`
              : userMessage.slice(0, 50) + (userMessage.length > 50 ? "…" : ""),
            model: selectedModel,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          updatedThreads.unshift(newThread);
        }

        const sorted = updatedThreads.sort(
          (a, b) => (b.updated_at > a.updated_at ? 1 : -1)
        );
        saveUserThreads(username, sorted);
        setThreads(sorted);
      }

      // ── 4. Safely refresh threads from backend if authenticated ──
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

