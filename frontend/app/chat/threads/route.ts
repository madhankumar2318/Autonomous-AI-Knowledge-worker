import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAuthToken, threadsStore, verifyToken } from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";

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
  const csrfCheck = verifyCsrf(req);
  if (!csrfCheck.ok) {
    return csrfErrorResponse(csrfCheck.reason);
  }

  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  let id: string;
  if (body.id && typeof body.id === "string") {
    const requestedId = body.id.trim();
    if (threadsStore.has(requestedId)) {
      return NextResponse.json({ message: "Thread ID already exists" }, { status: 409 });
    }
    id = requestedId;
  } else {
    id = "thread-" + crypto.randomUUID();
  }

  const thread = {
    id,
    username: username,
    title: body.title ? String(body.title).slice(0, 100) : "New Investigation",
    model: body.model ? String(body.model).slice(0, 50) : "gemini-3.8-flash",
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

