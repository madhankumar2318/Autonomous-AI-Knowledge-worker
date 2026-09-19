// frontend/app/config.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || process.env.NEXT_PUBLIC_API_BASE_URL
  || "https://autonomous-ai-knowledge-worker-backend.onrender.com";
