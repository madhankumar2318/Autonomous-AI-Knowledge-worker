// frontend/app/config.ts
// In production or preview, if NEXT_PUBLIC_API_URL is unset or points to an offline Render service,
// fallback to same-origin ("") so Next.js route handlers handle all auth, market, and AI requests.
const rawUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "";

export const API_BASE_URL =
  rawUrl && !rawUrl.includes("onrender.com") ? rawUrl.replace(/\/+$/, "") : "";

