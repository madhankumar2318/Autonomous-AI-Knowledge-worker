import { NextResponse } from "next/server";
import {
  getAuthToken,
  sanitizeCsvText,
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
  const body = await req.json().catch(() => ({}));

  const doc = uploadsStore.get(filename);
  if (!doc) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  // Tenant isolation: only the owner or admin can edit
  if (doc.username && doc.username !== username && username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  if (body.content !== undefined) {
    let contentToSave = String(body.content);
    if (filename.toLowerCase().endsWith(".csv")) {
      contentToSave = sanitizeCsvText(contentToSave);
    }
    doc.content = contentToSave;
    doc.size = Buffer.byteLength(contentToSave, "utf-8");
    uploadsStore.set(filename, doc);
    saveUploadFile(doc, Buffer.from(contentToSave, "utf-8"));

    logAuditEvent({
      type: "FILE_UPLOADED",
      severity: "INFO",
      username,
      ip: getClientIp(req),
      details: { action: "file_edited", filename, size: doc.size },
    });
  }

  return NextResponse.json({
    message: "File updated successfully",
    filename,
    size: doc.size,
  });
}
