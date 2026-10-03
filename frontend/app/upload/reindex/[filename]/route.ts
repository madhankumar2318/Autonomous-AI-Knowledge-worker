import { NextResponse } from "next/server";
import {
  cleanPdfTextFormatting,
  extractPdfText,
  getAuthToken,
  getUploadBuffer,
  sanitizeUploadFilename,
  saveUploadFile,
  uploadsStore,
  verifyToken,
} from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const csrfCheck = verifyCsrf(req);
  if (!csrfCheck.ok) {
    return csrfErrorResponse(csrfCheck.reason);
  }

  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { filename: rawFilename } = await params;
  const filename = sanitizeUploadFilename(decodeURIComponent(rawFilename));

  let doc = uploadsStore.get(filename);

  // IDOR / Tenant isolation check: Non-admin users can only re-index their own files
  if (doc && doc.username && doc.username !== username && username !== "admin") {
    return NextResponse.json(
      { message: "Forbidden. Access denied to requested document." },
      { status: 403 }
    );
  }

  const buffer = getUploadBuffer(filename);

  if (buffer) {
    const isPdf = filename.toLowerCase().endsWith(".pdf");
    const rawContent = isPdf ? await extractPdfText(buffer) : buffer.toString("utf-8");
    const content = cleanPdfTextFormatting(rawContent);
    doc = {
      id: doc?.id || `upl-${filename}`,
      username: doc?.username || "admin",
      filename,
      originalName: doc?.originalName || filename,
      contentType: isPdf ? "application/pdf" : "text/plain",
      size: buffer.length,
      uploadedAt: doc?.uploadedAt || new Date().toISOString(),
      status: "indexed",
      chunks: Math.max(1, Math.round(content.length / 400)),
      content,
    };
    saveUploadFile(doc, buffer);
  } else if (doc) {
    doc.status = "indexed";
    if (doc.content) {
      doc.content = cleanPdfTextFormatting(doc.content);
      doc.chunks = Math.max(1, Math.round(doc.content.length / 400));
    }
    saveUploadFile(doc);
  }

  const chunks = doc?.chunks || 4;

  return NextResponse.json({
    success: true,
    message: `File ${filename} re-indexed successfully.`,
    chunks,
    rag_indexed: true,
  });
}
