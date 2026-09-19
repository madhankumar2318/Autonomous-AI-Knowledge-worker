// In-memory data store & helper functions for Next.js full-stack routes

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
}

export interface UserSettingRecord {
  userId: string;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatThreadRecord {
  id: string;
  username: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
}

export interface UploadRecord {
  id: string;
  username: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "indexed" | "processing" | "ready";
  content?: string;
}

// Global persistent in-memory storage (preserved across HMR / module reloads)
const globalStore = globalThis as unknown as {
  __AKW_USERS__?: Map<string, UserRecord>;
  __AKW_SETTINGS__?: Map<string, UserSettingRecord>;
  __AKW_THREADS__?: Map<string, ChatThreadRecord>;
  __AKW_UPLOADS__?: Map<string, UploadRecord>;
};

if (!globalStore.__AKW_USERS__) {
  const users = new Map<string, UserRecord>();
  users.set("admin", {
    id: "admin-1",
    username: "admin",
    passwordHash: "Sk_uyir18", // Accepts Sk_uyir18, password, admin123
    name: "Administrator",
    email: "admin@knowledge-worker.local",
    mobile: "+1 555-0199",
    role: "ADMIN",
  });
  globalStore.__AKW_USERS__ = users;
}

if (!globalStore.__AKW_SETTINGS__) {
  const settings = new Map<string, UserSettingRecord>();
  settings.set("admin", {
    userId: "admin-1",
    defaultModel: "gemini-3.8-flash",
    temperature: 0.2,
    systemPrompt: "You are an autonomous AI Knowledge Worker assistant. Provide concise, high-value, factual, analytical insights, clear code, and structured market analysis.",
    chunkSize: 800,
    chunkOverlap: 100,
  });
  globalStore.__AKW_SETTINGS__ = settings;
}

if (!globalStore.__AKW_THREADS__) {
  const threads = new Map<string, ChatThreadRecord>();
  const defaultThread: ChatThreadRecord = {
    id: "thread-welcome",
    username: "admin",
    title: "Market & Knowledge Intelligence",
    model: "gemini-3.8-flash",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "msg-1",
        role: "assistant",
        content: "Hello! I am your Autonomous AI Knowledge Worker. How can I assist you today with market analysis, document synthesis, or news research?",
        timestamp: Date.now(),
      },
    ],
  };
  threads.set(defaultThread.id, defaultThread);
  globalStore.__AKW_THREADS__ = threads;
}

if (!globalStore.__AKW_UPLOADS__) {
  const uploads = new Map<string, UploadRecord>();
  const sampleUpload: UploadRecord = {
    id: "upload-1",
    username: "admin",
    filename: "q3_financial_brief.md",
    originalName: "q3_financial_brief.md",
    contentType: "text/markdown",
    size: 2048,
    uploadedAt: new Date().toISOString(),
    status: "indexed",
    content: `# Q3 Corporate Financial & Technology Overview\n\n## Executive Summary\nRevenue increased by 14.2% YoY driven by cloud infrastructure and enterprise AI subscriptions. Operating margins expanded to 28.5%.\n\n| Metric | Q3 Actual | Q3 Guidance | YoY Growth |\n|---|---|---|---|\n| Revenue | $48.2B | $46.5B | +14.2% |\n| Operating Income | $13.7B | $12.8B | +18.1% |\n| Free Cash Flow | $9.4B | $8.6B | +15.0% |\n| EPS | $1.82 | $1.70 | +19.7% |\n\n## Key Strategic Initiatives\n1. Expansion of Autonomous AI Workflow agents across enterprise deployments.\n2. Optimization of inference latency and distributed caching architecture.\n3. Increased capital expenditure allocated towards high-bandwidth datacenter infrastructure.`,
  };
  uploads.set(sampleUpload.filename, sampleUpload);
  globalStore.__AKW_UPLOADS__ = uploads;
}

export const usersStore = globalStore.__AKW_USERS__!;
export const settingsStore = globalStore.__AKW_SETTINGS__!;
export const threadsStore = globalStore.__AKW_THREADS__!;
export const uploadsStore = globalStore.__AKW_UPLOADS__!;

export function generateToken(username: string): string {
  const payload = {
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
  return `jwt_${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

export function verifyToken(token: string | null): string | null {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, "");
  if (cleanToken.startsWith("jwt_")) {
    try {
      const payloadStr = Buffer.from(cleanToken.slice(4), "base64url").toString("utf-8");
      const payload = JSON.parse(payloadStr);
      if (payload.sub) return payload.sub;
    } catch {
      return null;
    }
  }
  // Allow demo tokens or admin fallback
  if (cleanToken.length > 5) return "admin";
  return null;
}
