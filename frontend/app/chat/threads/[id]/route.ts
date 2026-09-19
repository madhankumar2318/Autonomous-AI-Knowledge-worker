import { NextResponse } from "next/server";
import { threadsStore } from "@/app/lib/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const thread = threadsStore.get(id);

  if (!thread) {
    return NextResponse.json({ message: "Thread not found" }, { status: 404 });
  }

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
  const { id } = await params;
  threadsStore.delete(id);
  return NextResponse.json({ message: "Thread deleted successfully" });
}
