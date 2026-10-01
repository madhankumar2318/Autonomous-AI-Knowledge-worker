import { NextResponse } from "next/server";
import { getAuthToken, threadsStore, verifyToken } from "@/app/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  if (threadsStore.has("thread-welcome")) {
    threadsStore.delete("thread-welcome");
  }

  const { searchParams } = new URL(req.url);
  const requestedUser = searchParams.get("username") || username;
  const targetUser = username === "admin" ? requestedUser : username;

  const threads = Array.from(threadsStore.values())
    .filter(
      (t) =>
        t &&
        t.id !== "thread-welcome" &&
        t.title !== "Market & Knowledge Intelligence" &&
        (!t.username || t.username === targetUser),
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
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = body.id || "thread-" + Date.now();
  const thread = {
    id,
    username: username,
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

