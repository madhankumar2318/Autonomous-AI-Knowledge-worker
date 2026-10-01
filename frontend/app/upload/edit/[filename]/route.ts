import { NextResponse } from "next/server";
import { getAuthToken, sanitizeUploadFilename, uploadsStore, verifyToken } from "@/app/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { filename: rawFilename } = await params;
  const filename = sanitizeUploadFilename(decodeURIComponent(rawFilename));
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
