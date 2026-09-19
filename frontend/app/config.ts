// frontend/app/config.ts
// In production (Vercel), NEXT_PUBLIC_API_URL is set via .env.production pointing to the Render backend.
// In local dev, set NEXT_PUBLIC_API_URL in .env.local (see .env.local.example).
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://autonomous-ai-knowledge-worker-backend.onrender.com";
