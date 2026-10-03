export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  extractPdfText,
  getAuthToken,
  getUploadBuffer,
  getUploadRecord,
  uploadsStore,
  verifyToken,
} from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  let doc = getUploadRecord(filename) || uploadsStore.get(filename);
  if (!doc) {
    const buffer = getUploadBuffer(filename);
    if (buffer) {
      const isPdf = filename.toLowerCase().endsWith(".pdf");
      const content = isPdf
        ? await extractPdfText(buffer)
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

  // IDOR / Tenant isolation check: Non-admin users can only view their own document content
  if (username !== "admin" && (!doc.username || doc.username !== username)) {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  return NextResponse.json(
    {
      content: doc.content || "",
      filename: doc.filename,
      size: doc.size,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
