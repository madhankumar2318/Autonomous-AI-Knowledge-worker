import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);
  const body = await req.json().catch(() => ({}));

  const doc = uploadsStore.get(filename);
  if (!doc) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  if (body.content !== undefined) {
    doc.content = body.content;
    doc.size = Buffer.byteLength(body.content, "utf-8");
    uploadsStore.set(filename, doc);
  }

  return NextResponse.json({
    message: "File updated successfully",
    filename,
    size: doc.size,
  });
}
