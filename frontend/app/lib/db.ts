import { Pool } from "pg";
import type { UserRecord, UserSessionRecord } from "./store";

// In AI Studio web environment, direct TCP to external databases is blocked.
// If DATABASE_URL is set (e.g. Cloud SQL socket or configured URL), use Pool with fast timeout;
// otherwise mock dbPool with an in-memory stub that falls back seamlessly to the persistent store.
const connectionString = process.env.DATABASE_URL;

interface MockPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  connect?: () => Promise<{ query: () => Promise<{ rows: any[] }>; release: () => void }>;
}

const globalForDb = globalThis as unknown as { __akw_pg_pool__?: Pool | MockPool };

function createDbPool(): Pool | MockPool {
  if (connectionString) {
    try {
      return new Pool({
        connectionString,
        ssl: connectionString.includes("localhost") || connectionString.includes("/cloudsql/") ? false : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 2000,
      });
    } catch {
      console.warn("[DB] Failed to initialize Pool, using in-memory mock");
    }
  }
  // Mock DB pool
  return {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  };
}

export const dbPool = globalForDb.__akw_pg_pool__ ?? createDbPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__akw_pg_pool__ = dbPool;
}

export async function getDbUser(username: string): Promise<UserRecord | null> {
  if (!username) return null;
  try {
    const res = await dbPool.query(
      `SELECT id, username, password as "passwordHash", name, email, mobile,
              COALESCE(role, 'ADMIN') as role, avatar,
              default_starting_screen as "defaultStartingTab",
              time_format as "timeFormat",
              date_format as "dateFormat",
              sound_effects as "soundEffects"
       FROM public.users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username.trim()]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      username: r.username,
      passwordHash: r.passwordHash || "",
      name: r.name || r.username,
      email: r.email || `${r.username}@example.com`,
      mobile: r.mobile || "",
      role: r.role || (r.username.toLowerCase() === "admin" ? "ADMIN" : "USER"),
      avatar: r.avatar || "",
      defaultStartingTab: r.defaultStartingTab || "news",
      timeFormat: r.timeFormat || "12h",
      dateFormat: r.dateFormat || "DD/MM/YYYY",
      soundEffects: r.soundEffects ?? true,
      tokenVersion: 1,
    };
  } catch (err) {
    console.warn("[DB] Failed to query user from PostgreSQL, falling back:", (err as Error).message);
    return null;
  }
}

export async function updateDbUser(
  username: string,
  updates: {
    name?: string;
    email?: string;
    mobile?: string;
    avatar?: string;
    defaultStartingTab?: string;
    timeFormat?: string;
    dateFormat?: string;
    soundEffects?: boolean;
    passwordHash?: string;
  }
): Promise<UserRecord | null> {
  if (!username) return null;
  try {
    const res = await dbPool.query(
      `UPDATE public.users SET
        name = CASE
          WHEN $1 IS NULL THEN name
          WHEN $1 = 'Administrator' AND name IS NOT NULL AND name != '' AND name != 'Administrator' THEN name
          WHEN LENGTH(TRIM($1)) > 0 THEN $1
          ELSE name
        END,
        email = COALESCE(NULLIF(TRIM($2), ''), email),
        mobile = COALESCE(NULLIF(TRIM($3), ''), mobile),
        avatar = CASE
          WHEN $4 = '__REMOVE__' THEN NULL
          WHEN $4 IS NOT NULL AND LENGTH(TRIM($4)) > 0 THEN $4
          ELSE avatar
        END,
        default_starting_screen = COALESCE(NULLIF(TRIM($5), ''), default_starting_screen),
        time_format = COALESCE(NULLIF(TRIM($6), ''), time_format),
        date_format = COALESCE(NULLIF(TRIM($7), ''), date_format),
        sound_effects = COALESCE($8, sound_effects),
        password = COALESCE(NULLIF(TRIM($9), ''), password)
       WHERE LOWER(username) = LOWER($10)
       RETURNING id, username, password as "passwordHash", name, email, mobile,
                 COALESCE(role, 'ADMIN') as role, avatar,
                 default_starting_screen as "defaultStartingTab",
                 time_format as "timeFormat",
                 date_format as "dateFormat",
                 sound_effects as "soundEffects"`,
      [
        updates.name ?? null,
        updates.email ?? null,
        updates.mobile ?? null,
        updates.avatar ?? null,
        updates.defaultStartingTab ?? null,
        updates.timeFormat ?? null,
        updates.dateFormat ?? null,
        updates.soundEffects ?? null,
        updates.passwordHash ?? null,
        username.trim(),
      ]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      username: r.username,
      passwordHash: r.passwordHash || "",
      name: r.name || r.username,
      email: r.email || `${r.username}@example.com`,
      mobile: r.mobile || "",
      role: r.role || (r.username.toLowerCase() === "admin" ? "ADMIN" : "USER"),
      avatar: r.avatar || "",
      defaultStartingTab: r.defaultStartingTab || "news",
      timeFormat: r.timeFormat || "12h",
      dateFormat: r.dateFormat || "DD/MM/YYYY",
      soundEffects: r.soundEffects ?? true,
      tokenVersion: 1,
    };
  } catch (err) {
    console.warn("[DB] Failed to update user in PostgreSQL:", (err as Error).message);
    return null;
  }
}

export async function recordDbSession(
  username: string,
  session: {
    id: string;
    deviceType: string;
    os: string;
    browser: string;
    ip: string;
    userAgent: string;
  }
): Promise<void> {
  if (!username || !session.id) return;
  try {
    // 1. Clean up stale/ghost records for this user (unknown IP older than 1 hr, or old revoked tokens)
    await dbPool.query(
      `DELETE FROM public.refresh_tokens
       WHERE LOWER(username) = LOWER($1)
         AND (
           (ip_address = 'unknown' AND last_active_at < NOW() - interval '1 hour')
           OR (revoked = true AND last_active_at < NOW() - interval '1 day')
           OR (last_active_at < NOW() - interval '30 days')
         )`,
      [username.trim()]
    ).catch(() => {});

    // 2. Check if an active session already exists for this exact device or family_id
    const updateRes = await dbPool.query(
      `UPDATE public.refresh_tokens
       SET family_id = $4,
           device_type = $5,
           os = $6,
           browser = $7,
           last_active_at = NOW(),
           ip_address = $1,
           user_agent = $2,
           revoked = false
       WHERE LOWER(username) = LOWER($3)
         AND (family_id = $4 OR (device_type = $5 AND os = $6 AND (revoked = false OR revoked IS NULL)))`,
      [
        session.ip,
        session.userAgent,
        username.trim(),
        session.id,
        session.deviceType,
        session.os,
        session.browser,
      ]
    );

    if (updateRes.rowCount === 0) {
      await dbPool.query(
        `INSERT INTO public.refresh_tokens (
           username, token, family_id, device_type, os, browser,
           ip_address, user_agent, last_active_at, expires_at, revoked, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + interval '30 days', false, NOW()
         )`,
        [
          username.trim(),
          `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          session.id,
          session.deviceType,
          session.os,
          session.browser,
          session.ip,
          session.userAgent,
        ]
      );
    }
  } catch (err) {
    console.warn("[DB] Failed to record session in PostgreSQL:", (err as Error).message);
  }
}

export async function getDbSessions(username: string): Promise<UserSessionRecord[]> {
  if (!username) return [];
  try {
    const res = await dbPool.query(
      `SELECT id, username, family_id, device_type, os, browser, ip_address, user_agent,
              EXTRACT(EPOCH FROM COALESCE(last_active_at, created_at)) * 1000 AS "lastActiveAt",
              EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
       FROM public.refresh_tokens
       WHERE LOWER(username) = LOWER($1)
         AND (revoked = false OR revoked IS NULL)
         AND (expires_at > NOW() OR expires_at IS NULL)
         AND device_type IS NOT NULL
         AND (ip_address != 'unknown' OR last_active_at > NOW() - interval '5 minutes')
       ORDER BY last_active_at DESC NULLS LAST, created_at DESC
       LIMIT 10`,
      [username.trim()]
    );

    const sessions: UserSessionRecord[] = [];
    const seen = new Set<string>();

    for (const r of res.rows) {
      // Deduplicate strictly by device_type + os so each real physical device gets at most 1 card
      const signature = `${r.device_type}-${r.os}`;
      if (seen.has(signature)) continue;
      seen.add(signature);

      sessions.push({
        id: r.family_id || String(r.id),
        username: r.username,
        deviceType: (r.device_type as any) || "Desktop",
        os: r.os || "Unknown",
        browser: r.browser || "Unknown",
        ip: r.ip_address || "127.0.0.1",
        userAgent: r.user_agent || "",
        lastActiveAt: Number(r.lastActiveAt) || Date.now(),
        createdAt: Number(r.createdAt) || Date.now(),
      });
    }

    return sessions;
  } catch (err) {
    console.warn("[DB] Failed to get sessions from PostgreSQL:", (err as Error).message);
    return [];
  }
}

export async function removeDbSession(username: string, sessionId: string): Promise<void> {
  if (!username || !sessionId) return;
  try {
    await dbPool.query(
      `UPDATE public.refresh_tokens
       SET revoked = true
       WHERE LOWER(username) = LOWER($1)
         AND (family_id = $2 OR id::text = $2 OR token = $2)`,
      [username.trim(), sessionId]
    );
  } catch (err) {
    console.warn("[DB] Failed to remove session from PostgreSQL:", (err as Error).message);
  }
}

export async function removeOtherDbSessions(username: string, currentSessionId: string): Promise<void> {
  if (!username) return;
  try {
    await dbPool.query(
      `UPDATE public.refresh_tokens
       SET revoked = true
       WHERE LOWER(username) = LOWER($1)
         AND family_id != $2
         AND id::text != $2`,
      [username.trim(), currentSessionId]
    );
  } catch (err) {
    console.warn("[DB] Failed to remove other sessions from PostgreSQL:", (err as Error).message);
  }
}

export async function isDbSessionRevoked(username: string, sessionId: string): Promise<boolean> {
  if (!username || !sessionId) return false;
  try {
    const res = await dbPool.query(
      `SELECT revoked FROM public.refresh_tokens
       WHERE LOWER(username) = LOWER($1)
         AND (family_id = $2 OR id::text = $2)
       LIMIT 1`,
      [username.trim(), sessionId]
    );
    if (res.rows.length > 0 && res.rows[0].revoked === true) {
      return true;
    }
  } catch {}
  return false;
}
