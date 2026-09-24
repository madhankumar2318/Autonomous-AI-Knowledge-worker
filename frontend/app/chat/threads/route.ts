import { NextResponse } from "next/server";
import { threadsStore } from "@/app/lib/store";

export async function GET() {
  if (threadsStore.has("thread-welcome")) {
    threadsStore.delete("thread-welcome");
  }

  const threads = Array.from(threadsStore.values())
    .filter(
      (t) =>
        t &&
        t.id !== "thread-welcome" &&
        t.title !== "Market & Knowledge Intelligence",
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      model: t.model,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      message_count: t.messages.length,
    }));

  return NextResponse.json(threads);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = "thread-" + Date.now();
  const thread = {
    id,
    username: body.username || "admin",
    title: body.title || "New Investigation",
    model: body.model || "gemini-3.8-flash",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  threadsStore.set(id, thread);

  return NextResponse.json({
    id: thread.id,
    title: thread.title,
    model: thread.model,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    message_count: 0,
  });
}
