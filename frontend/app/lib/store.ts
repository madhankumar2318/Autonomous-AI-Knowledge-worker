import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";

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
  chunks?: number;
}

// ── Persistent Disk Storage Helpers ──────────────────────────────────────────

export function getStorageDirs(): string[] {
  const dirs = [
    path.resolve(process.cwd(), "uploads_storage"),
    path.resolve(process.cwd(), "../uploads_storage"),
    path.resolve("/app/applet/uploads_storage"),
    path.resolve("/app/applet/frontend/uploads_storage"),
  ];
  return Array.from(new Set(dirs));
}

export function getPrimaryStorageDir(): string {
  const dirs = getStorageDirs();
  for (const d of dirs) {
    if (fs.existsSync(d)) return d;
  }
  const defaultDir = dirs[0];
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
  } catch {}
  return defaultDir;
}

const nodeRequire = typeof createRequire === "function" ? createRequire(import.meta.url) : null;

function getPdfJs(): any {
  const candidatePaths = [
    path.resolve(process.cwd(), "frontend/node_modules/pdfjs-dist/legacy/build/pdf.js"),
    path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.js"),
    "/app/applet/frontend/node_modules/pdfjs-dist/legacy/build/pdf.js",
    "/app/applet/node_modules/pdfjs-dist/legacy/build/pdf.js",
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        if (nodeRequire) return nodeRequire(p);
        return require(p);
      }
    } catch {}
  }
  try {
    if (nodeRequire) {
      return nodeRequire("pdfjs-dist/legacy/build/pdf.js");
    }
  } catch {}
  try {
    return require("pdfjs-dist/legacy/build/pdf.js");
  } catch {
    return null;
  }
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // 1. High-accuracy extraction via pdfjs-dist legacy engine
  try {
    const pdfjs = getPdfJs();
    if (pdfjs && typeof pdfjs.getDocument === "function") {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true,
      });
      const pdf = await loadingTask.promise;
      const pagesText: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items
            .map((item: any) => (item && typeof item.str === "string" ? item.str : ""))
            .filter(Boolean);
          const pageText = pageStrings.join(" ").trim();
          if (pageText) {
            pagesText.push(`[Page ${pageNum}]\n${pageText}`);
          }
        } catch (_pageErr) {}
      }

      const combined = pagesText.join("\n\n").trim();
      // If pdfjs extracted real text, prioritize it above everything else
      if (combined.length > 20) {
        return combined;
      }
      const syncResult = extractPdfTextSync(buffer);
      if (syncResult && syncResult.length > combined.length) {
        return syncResult;
      }
      if (combined) {
        return combined;
      }
    }
  } catch (_e) {}

  // 2. Stream decompression and text extraction fallback
  return extractPdfTextSync(buffer);
}

export function extractPdfTextSync(buffer: Buffer): string {
  try {
    const content = buffer.toString("binary");
    const textPieces: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      const rawStream = Buffer.from(match[1], "binary");
      let decompressed = "";
      try {
        decompressed = zlib.inflateSync(rawStream).toString("utf-8");
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString("utf-8");
        } catch {
          decompressed = rawStream.toString("utf-8");
        }
      }

      // Match text inside (...) Tj
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let m: RegExpExecArray | null;
      while ((m = tjRegex.exec(decompressed)) !== null) {
        textPieces.push(unescapePdfText(m[1]));
      }

      // Match text inside [...] TJ
      const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
      while ((m = arrayRegex.exec(decompressed)) !== null) {
        const innerRegex = /\(([^)]+)\)/g;
        let inner: RegExpExecArray | null;
        const arr: string[] = [];
        while ((inner = innerRegex.exec(m[1])) !== null) {
          arr.push(unescapePdfText(inner[1]));
        }
        if (arr.length) textPieces.push(arr.join(" "));
      }
    }

    let full = textPieces.join(" ").replace(/\s+/g, " ").trim();

    // Also extract all direct Tj operators from uncompressed stream or raw binary
    const directTjRegex = /\(([^)]+)\)\s*Tj/g;
    let directM: RegExpExecArray | null;
    const directTjPieces: string[] = [];
    while ((directM = directTjRegex.exec(content)) !== null) {
      directTjPieces.push(unescapePdfText(directM[1]));
    }
    const directFull = directTjPieces.join(" ").replace(/\s+/g, " ").trim();

    if (directFull.length > full.length) {
      full = directFull;
    }

    if (full.length > 20) return full;

    // Fallback: search for direct text strings in binary stream
    const fallbackPieces: string[] = [];
    const plainRegex = /\(([^)]{3,})\)/g;
    let fallbackMatch: RegExpExecArray | null;
    while ((fallbackMatch = plainRegex.exec(content)) !== null) {
      const cleaned = unescapePdfText(fallbackMatch[1]).trim();
      if (cleaned.length > 2 && /^[a-zA-Z0-9\s.,;:_/@\-+]+$/.test(cleaned)) {
        fallbackPieces.push(cleaned);
      }
    }
    return fallbackPieces.join(" ").replace(/\s+/g, " ").trim() || full || "PDF Document parsed.";
  } catch (_e) {
    return "PDF Document loaded.";
  }
}

function unescapePdfText(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

// Global persistent in-memory storage (preserved across HMR / module reloads)
const globalStore = globalThis as unknown as {
  __AKW_USERS__?: Map<string, UserRecord>;
  __AKW_SETTINGS__?: Map<string, UserSettingRecord>;
  __AKW_THREADS__?: Map<string, ChatThreadRecord>;
  __AKW_UPLOADS__?: Map<string, UploadRecord>;
  __AKW_BUFFERS__?: Map<string, Buffer>;
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
  globalStore.__AKW_THREADS__ = new Map<string, ChatThreadRecord>();
}
// Clean up any legacy default placeholder thread
if (globalStore.__AKW_THREADS__.has("thread-welcome")) {
  globalStore.__AKW_THREADS__.delete("thread-welcome");
}

export function syncUploadsFromDisk(): Map<string, UploadRecord> {
  if (!globalStore.__AKW_UPLOADS__) {
    globalStore.__AKW_UPLOADS__ = new Map<string, UploadRecord>();
  }
  if (!globalStore.__AKW_BUFFERS__) {
    globalStore.__AKW_BUFFERS__ = new Map<string, Buffer>();
  }

  const uploads = globalStore.__AKW_UPLOADS__;
  const dirs = getStorageDirs();

  // 1. First, check for uploads_index.json across all storage directories
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const indexFile = path.join(dir, "uploads_index.json");
        if (fs.existsSync(indexFile)) {
          const raw = fs.readFileSync(indexFile, "utf-8");
          const records = JSON.parse(raw);
          if (Array.isArray(records)) {
            for (const r of records) {
              if (r && r.filename && !uploads.has(r.filename)) {
                uploads.set(r.filename, r);
              }
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 2. Auto-scan all storage directories for physical files
  for (const dir of dirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith(".json") || file.toLowerCase() === "q3_financial_brief.md") continue;
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            const isPdf = file.toLowerCase().endsWith(".pdf");
            let buffer: Buffer | null = null;
            try {
              buffer = fs.readFileSync(filePath);
              if (!globalStore.__AKW_BUFFERS__!.has(file)) {
                globalStore.__AKW_BUFFERS__!.set(file, buffer);
              }
            } catch {}

            if (!uploads.has(file)) {
              let extracted = "";
              if (isPdf && buffer) {
                try {
                  extracted = extractPdfTextSync(buffer);
                } catch {}
              } else if (buffer) {
                try {
                  extracted = buffer.toString("utf-8");
                } catch {}
              }

              const chunks = Math.max(1, Math.round(stat.size / 500));
              uploads.set(file, {
                id: `upl-${file}`,
                username: "admin",
                filename: file,
                originalName: file,
                contentType: isPdf ? "application/pdf" : "text/plain",
                size: stat.size,
                uploadedAt: stat.mtime.toISOString(),
                status: "indexed",
                chunks,
                content: extracted,
              });
            }
          }
        }
      }
    } catch (_e) {}
  }

  return uploads;
}

if (!globalStore.__AKW_UPLOADS__) {
  globalStore.__AKW_UPLOADS__ = new Map<string, UploadRecord>();
}
if (!globalStore.__AKW_BUFFERS__) {
  globalStore.__AKW_BUFFERS__ = new Map<string, Buffer>();
}

// Initial synchronization from disk
syncUploadsFromDisk();

export const usersStore = globalStore.__AKW_USERS__!;
export const settingsStore = globalStore.__AKW_SETTINGS__!;
export const threadsStore = globalStore.__AKW_THREADS__!;
export const uploadsStore = globalStore.__AKW_UPLOADS__!;
export const buffersStore = globalStore.__AKW_BUFFERS__!;

export function saveUploadFile(record: UploadRecord, buffer?: Buffer) {
  uploadsStore.set(record.filename, record);

  // Cache in-memory buffer
  if (buffer) {
    buffersStore.set(record.filename, buffer);
    const decoded = decodeURIComponent(record.filename);
    if (decoded !== record.filename) {
      buffersStore.set(decoded, buffer);
    }
  }

  // Save to disk across all storage directories
  if (buffer) {
    for (const dir of getStorageDirs()) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, record.filename);
        fs.writeFileSync(filePath, buffer);
      } catch (_e) {}
    }
  }

  // Update persistent registry in all storage directories
  const arr = Array.from(uploadsStore.values());
  for (const dir of getStorageDirs()) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const registryPath = path.join(dir, "uploads_index.json");
      fs.writeFileSync(registryPath, JSON.stringify(arr, null, 2), "utf-8");
    } catch (_e) {}
  }
}

export function getUploadBuffer(filename: string): Buffer | null {
  const decoded = decodeURIComponent(filename);

  // 1. Check in-memory buffer store
  if (buffersStore.has(filename)) {
    return buffersStore.get(filename)!;
  }
  if (buffersStore.has(decoded)) {
    return buffersStore.get(decoded)!;
  }

  // 2. Check disk storage directories
  for (const dir of getStorageDirs()) {
    try {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        buffersStore.set(filename, buf);
        return buf;
      }
      const decodedPath = path.join(dir, decoded);
      if (fs.existsSync(decodedPath)) {
        const buf = fs.readFileSync(decodedPath);
        buffersStore.set(filename, buf);
        return buf;
      }
    } catch (_e) {}
  }

  // 3. Re-sync from disk if not found yet
  syncUploadsFromDisk();
  if (buffersStore.has(filename)) return buffersStore.get(filename)!;
  if (buffersStore.has(decoded)) return buffersStore.get(decoded)!;

  const doc = uploadsStore.get(filename) || uploadsStore.get(decoded);
  if (doc?.content && !filename.toLowerCase().endsWith(".pdf")) {
    return Buffer.from(doc.content, "utf-8");
  }
  return null;
}

export function getUploadRecord(filename: string): UploadRecord | null {
  const decoded = decodeURIComponent(filename).trim();
  const lower = decoded.toLowerCase();

  if (uploadsStore.has(filename)) return uploadsStore.get(filename)!;
  if (uploadsStore.has(decoded)) return uploadsStore.get(decoded)!;

  for (const [key, val] of Array.from(uploadsStore.entries())) {
    if (
      key === filename ||
      key === decoded ||
      key.toLowerCase() === lower ||
      val.filename.toLowerCase() === lower ||
      val.originalName?.toLowerCase() === lower
    ) {
      return val;
    }
  }

  // Check disk sync if not found
  syncUploadsFromDisk();
  if (uploadsStore.has(filename)) return uploadsStore.get(filename)!;
  if (uploadsStore.has(decoded)) return uploadsStore.get(decoded)!;
  for (const [, val] of Array.from(uploadsStore.entries())) {
    if (
      val.filename.toLowerCase() === lower ||
      val.originalName?.toLowerCase() === lower
    ) {
      return val;
    }
  }

  return null;
}

export function deleteUploadFile(filename: string) {
  const decoded = decodeURIComponent(filename).trim();
  const lower = decoded.toLowerCase();

  // 1. Delete from in-memory stores
  uploadsStore.delete(filename);
  uploadsStore.delete(decoded);
  buffersStore.delete(filename);
  buffersStore.delete(decoded);
  for (const [key, val] of Array.from(uploadsStore.entries())) {
    if (
      key === filename ||
      key === decoded ||
      key.toLowerCase() === lower ||
      val.filename.toLowerCase() === lower ||
      val.originalName?.toLowerCase() === lower
    ) {
      uploadsStore.delete(key);
      buffersStore.delete(key);
    }
  }

  // 2. Delete matching files from all storage directories
  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith(".json")) continue;
          if (
            file === filename ||
            file === decoded ||
            file.toLowerCase() === lower ||
            decodeURIComponent(file).toLowerCase() === lower
          ) {
            const filePath = path.join(dir, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 3. Update persistent registry in all storage directories
  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const registryPath = path.join(dir, "uploads_index.json");
        if (fs.existsSync(registryPath)) {
          const arr = Array.from(uploadsStore.values());
          fs.writeFileSync(registryPath, JSON.stringify(arr, null, 2), "utf-8");
        }
      }
    } catch (_e) {}
  }
}

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
