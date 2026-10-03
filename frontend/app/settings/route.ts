import { NextResponse } from "next/server";
import { getAuthToken, verifyToken, settingsStore } from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }
  const setting = settingsStore.get(username) || {
    userId: "admin-1",
    defaultModel: "gemini-3.8-flash",
    temperature: 0.2,
    systemPrompt: "You are an autonomous AI Knowledge Worker assistant. Provide concise, high-value, factual, analytical insights, clear code, and structured market analysis.",
    chunkSize: 800,
    chunkOverlap: 100,
  };

  return NextResponse.json(setting);
}

export async function PUT(req: Request) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    const current = settingsStore.get(username) || {
      userId: "admin-1",
      defaultModel: "gemini-3.8-flash",
      temperature: 0.2,
      systemPrompt: "",
      chunkSize: 800,
      chunkOverlap: 100,
    };

    const rawTemp = body.temperature !== undefined ? Number(body.temperature) : current.temperature;
    const temperature = Number.isFinite(rawTemp) ? Math.max(0.0, Math.min(1.0, rawTemp)) : 0.2;

    const rawChunkSize = body.chunkSize !== undefined ? Number(body.chunkSize) : current.chunkSize;
    const chunkSize = Number.isFinite(rawChunkSize) ? Math.max(100, Math.min(4000, Math.round(rawChunkSize))) : 800;

    const maxOverlap = Math.floor(chunkSize / 2);
    const rawOverlap = body.chunkOverlap !== undefined ? Number(body.chunkOverlap) : current.chunkOverlap;
    const chunkOverlap = Number.isFinite(rawOverlap) ? Math.max(0, Math.min(maxOverlap, Math.round(rawOverlap))) : 100;

    const systemPrompt = body.systemPrompt !== undefined ? String(body.systemPrompt).slice(0, 2000) : current.systemPrompt;
    const defaultModel = body.defaultModel ? String(body.defaultModel).slice(0, 100) : current.defaultModel;

    const updated = {
      ...current,
      defaultModel,
      temperature,
      systemPrompt,
      chunkSize,
      chunkOverlap,
    };

    settingsStore.set(username, updated);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update settings" }, { status: 500 });
  }
}
