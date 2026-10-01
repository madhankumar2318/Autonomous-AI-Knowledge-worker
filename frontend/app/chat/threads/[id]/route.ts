import { NextResponse } from "next/server";
import { getAuthToken, threadsStore, verifyToken } from "@/app/lib/store";

export async function PATCH(
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
    return NextResponse.json({ message: "Thread not found" }, { status: 404 });
  }

  if (thread.username && thread.username !== username && username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.title) thread.title = body.title;
  thread.updatedAt = new Date().toISOString();
  threadsStore.set(id, thread);

  return NextResponse.json({
    id: thread.id,
    title: thread.title,
    model: thread.model,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { id } = await params;
  const thread = threadsStore.get(id);
  if (thread && thread.username && thread.username !== username && username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  threadsStore.delete(id);
  return NextResponse.json({ message: "Thread deleted successfully" });
}
