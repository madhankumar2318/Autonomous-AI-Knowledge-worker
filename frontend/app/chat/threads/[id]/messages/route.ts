import { NextResponse } from "next/server";
import { threadsStore } from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thread = threadsStore.get(id);

  if (!thread) {
    return NextResponse.json([]);
  }

  const msgs = thread.messages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "ai" : m.role,
    content: m.content,
    created_at: new Date(m.timestamp).toISOString(),
  }));

  return NextResponse.json(msgs);
}
