// Sliding-window rate limiter with Upstash / Redis distributed fallback for Next.js API routes

import { logAuditEvent } from "./audit-logger";

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Purge expired records periodically to avoid memory growth
let lastCleanup = Date.now();
function cleanupExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 60000) return; // Clean up at most once per minute
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    const valid = entry.timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      entry.timestamps = valid;
    }
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Synchronous local sliding-window rate limiter
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanupExpired(windowMs);

  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(key, entry);
  }

  // Filter timestamps within current window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    logAuditEvent({
      type: "RATE_LIMIT_TRIGGERED",
      severity: "WARN",
      ip: key.split(":")[1] || "unknown",
      details: { key, limit, windowMs, retryAfterSeconds },
    });

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Asynchronous distributed rate limiter with automatic in-memory fallback.
 * Uses Upstash REST Redis if UPSTASH_REDIS_REST_URL is configured in environment.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
      const redisKey = `rl:${key}`;

      const res = await fetch(`${redisUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, windowSec],
        ]),
        signal: AbortSignal.timeout(1500),
      });

      if (res.ok) {
        const data = await res.json();
        const currentCount = Number(data[0]?.result || 1);

        if (currentCount > limit) {
          logAuditEvent({
            type: "RATE_LIMIT_TRIGGERED",
            severity: "WARN",
            ip: key.split(":")[1] || "unknown",
            details: { key, limit, windowMs, source: "distributed_redis" },
          });

          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: windowSec,
          };
        }

        return {
          allowed: true,
          remaining: Math.max(0, limit - currentCount),
          retryAfterSeconds: 0,
        };
      }
    } catch (_redisErr) {
      // Fallback seamlessly to local in-memory sliding window
    }
  }

  return checkRateLimit(key, limit, windowMs);
}
