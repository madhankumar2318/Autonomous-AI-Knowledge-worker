import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  const doc = uploadsStore.get(filename);
  if (!doc) {
    return new Response("File not found", { status: 404 });
  }

  const content = doc.content || "Empty file content";
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "text/plain",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
