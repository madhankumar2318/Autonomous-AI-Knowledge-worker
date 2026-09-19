import { NextResponse } from "next/server";
import { verifyToken, settingsStore } from "@/app/lib/store";

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const username = verifyToken(authHeader) || "admin";
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
    const authHeader = req.headers.get("Authorization");
    const username = verifyToken(authHeader) || "admin";
    const body = await req.json().catch(() => ({}));

    const current = settingsStore.get(username) || {
      userId: "admin-1",
      defaultModel: "gemini-3.8-flash",
      temperature: 0.2,
      systemPrompt: "",
      chunkSize: 800,
      chunkOverlap: 100,
    };

    const updated = {
      ...current,
      ...(body.defaultModel ? { defaultModel: body.defaultModel } : {}),
      ...(body.temperature !== undefined ? { temperature: Number(body.temperature) } : {}),
      ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt } : {}),
      ...(body.chunkSize !== undefined ? { chunkSize: Number(body.chunkSize) } : {}),
      ...(body.chunkOverlap !== undefined ? { chunkOverlap: Number(body.chunkOverlap) } : {}),
    };

    settingsStore.set(username, updated);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update settings" }, { status: 500 });
  }
}
