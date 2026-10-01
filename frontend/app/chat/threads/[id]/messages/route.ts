import { NextResponse } from "next/server";
import { getAuthToken, threadsStore, verifyToken } from "@/app/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { id } = await params;
  const thread = threadsStore.get(id);

  if (!thread) {
    return NextResponse.json([]);
  }

  // IDOR protection: only allow thread owner or admin
  if (thread.username && thread.username !== username && username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  const msgs = thread.messages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "ai" : m.role,
    content: m.content,
    created_at: new Date(m.timestamp).toISOString(),
  }));

  return NextResponse.json(msgs);
}
