import { NextResponse } from "next/server";
import {
  extractPdfText,
  getUploadBuffer,
  uploadsStore,
} from "@/app/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  let doc = uploadsStore.get(filename);
  if (!doc) {
    const buffer = getUploadBuffer(filename);
    if (buffer) {
      const isPdf = filename.toLowerCase().endsWith(".pdf");
      const content = isPdf
        ? extractPdfText(buffer)
        : buffer.toString("utf-8");
      doc = {
        id: `upl-${filename}`,
        username: "admin",
        filename,
        originalName: filename,
        contentType: isPdf ? "application/pdf" : "text/plain",
        size: buffer.length,
        uploadedAt: new Date().toISOString(),
        status: "indexed",
        chunks: Math.max(1, Math.round(content.length / 400)),
        content,
      };
      uploadsStore.set(filename, doc);
    }
  }

  if (!doc) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  return NextResponse.json({
    content: doc.content || "",
    filename: doc.filename,
    size: doc.size,
  });
}
