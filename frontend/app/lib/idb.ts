// frontend/app/lib/idb.ts
// Client-side IndexedDB persistence for uploaded files (PDFs, docs, data)
// Ensures files and blobs survive page reloads, browser refreshes, and server restarts.

const DB_NAME = "ak_files_db";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function storeLocalFileBlob(filename: string, blob: Blob): Promise<void> {
  if (!filename || !blob) return;
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, filename);

    const decoded = decodeURIComponent(filename);
    if (decoded !== filename) {
      store.put(blob, decoded);
    }

    const norm = normalizeKey(decoded);
    if (norm && norm !== filename && norm !== decoded) {
      store.put(blob, `__norm__${norm}`);
    }
  } catch (e) {
    console.warn("Failed to store blob in IndexedDB:", e);
  }
}

export async function getLocalFileBlob(filename: string): Promise<Blob | null> {
  if (!filename) return null;
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      // 1. Direct match
      const req1 = store.get(filename);
      req1.onsuccess = () => {
        if (req1.result) {
          resolve(req1.result);
          return;
        }

        // 2. Decoded match
        const decoded = decodeURIComponent(filename);
        if (decoded !== filename) {
          const req2 = store.get(decoded);
          req2.onsuccess = () => {
            if (req2.result) {
              resolve(req2.result);
              return;
            }
            tryNorm();
          };
          req2.onerror = () => tryNorm();
        } else {
          tryNorm();
        }
      };
      req1.onerror = () => tryNorm();

      function tryNorm() {
        const norm = normalizeKey(decodeURIComponent(filename));
        const reqNorm = store.get(`__norm__${norm}`);
        reqNorm.onsuccess = () => {
          if (reqNorm.result) {
            resolve(reqNorm.result);
            return;
          }
          scanAllKeys();
        };
        reqNorm.onerror = () => scanAllKeys();
      }

      function scanAllKeys() {
        if (typeof store.getAllKeys !== "function") {
          resolve(null);
          return;
        }
        const targetNorm = normalizeKey(decodeURIComponent(filename));
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const keys = (keysReq.result || []) as string[];
          const match = keys.find((k) => {
            const cleanK = k.startsWith("__norm__") ? k.slice(8) : normalizeKey(decodeURIComponent(k));
            return cleanK === targetNorm;
          });
          if (match) {
            const fetchReq = store.get(match);
            fetchReq.onsuccess = () => resolve(fetchReq.result || null);
            fetchReq.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        keysReq.onerror = () => resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function deleteLocalFileBlob(filename: string): Promise<void> {
  if (!filename) return;
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(filename);
    const decoded = decodeURIComponent(filename);
    if (decoded !== filename) {
      store.delete(decoded);
    }
    const norm = normalizeKey(decoded);
    store.delete(`__norm__${norm}`);
    store.delete(`__text__${filename}`);
    store.delete(`__text__${decoded}`);
    store.delete(`__text_norm__${norm}`);
  } catch {}
}

export async function storeLocalFileText(filename: string, text: string): Promise<void> {
  if (!filename || !text) return;
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(text, `__text__${filename}`);
    const decoded = decodeURIComponent(filename);
    if (decoded !== filename) {
      store.put(text, `__text__${decoded}`);
    }
    const norm = normalizeKey(decoded);
    if (norm) {
      store.put(text, `__text_norm__${norm}`);
    }
  } catch (e) {
    console.warn("Failed to store text in IndexedDB:", e);
  }
}

export async function getLocalFileText(filename: string): Promise<string | null> {
  if (!filename) return null;
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      const req1 = store.get(`__text__${filename}`);
      req1.onsuccess = () => {
        if (typeof req1.result === "string" && req1.result.trim()) {
          resolve(req1.result);
          return;
        }
        const decoded = decodeURIComponent(filename);
        const req2 = store.get(`__text__${decoded}`);
        req2.onsuccess = () => {
          if (typeof req2.result === "string" && req2.result.trim()) {
            resolve(req2.result);
            return;
          }
          const norm = normalizeKey(decoded);
          const req3 = store.get(`__text_norm__${norm}`);
          req3.onsuccess = () => {
            if (typeof req3.result === "string" && req3.result.trim()) {
              resolve(req3.result);
            } else {
              resolve(null);
            }
          };
          req3.onerror = () => resolve(null);
        };
        req2.onerror = () => resolve(null);
      };
      req1.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

