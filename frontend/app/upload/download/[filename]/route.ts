export const dynamic = "force-dynamic";

import {
  getAuthToken,
  getUploadBuffer,
  getUploadRecord,
  sanitizeUploadFilename,
  uploadsStore,
  verifyToken,
} from "@/app/lib/store";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return new Response(JSON.stringify({ message: "Unauthorized. Please log in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { filename: rawFilename } = await params;
  const filename = sanitizeUploadFilename(decodeURIComponent(rawFilename));

  let doc = getUploadRecord(filename) || uploadsStore.get(filename) || uploadsStore.get(rawFilename);
  let buffer = getUploadBuffer(filename) || getUploadBuffer(rawFilename);

  if (!doc || !buffer) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetNorm = norm(filename);
    for (const [key, val] of Array.from(uploadsStore.entries())) {
      if (norm(key) === targetNorm || norm(val.filename) === targetNorm) {
        if (!doc) doc = val;
        if (!buffer) buffer = getUploadBuffer(val.filename) || getUploadBuffer(key);
        break;
      }
    }
  }

  if (!buffer && !doc) {
    return new Response("File not found", { status: 404 });
  }

  // IDOR / Tenant Isolation check: Non-admin users can only download their own files
  if (doc && doc.username && doc.username !== username && username !== "admin") {
    return new Response(JSON.stringify({ message: "Forbidden. Access denied to requested document." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isPdf = filename.toLowerCase().endsWith(".pdf");

  if (isPdf && !buffer) {
    return new Response("PDF binary not available on server. Use client cache or view extracted text.", {
      status: 404,
    });
  }

  const contentType =
    doc?.contentType || (isPdf ? "application/pdf" : "application/octet-stream");

  const responseData = buffer || Buffer.from(doc?.content || "", "utf-8");

  // Stored XSS defense: Only PDFs are allowed inline rendering. All other files force attachment download.
  const disposition = isPdf
    ? `inline; filename="${encodeURIComponent(filename)}"`
    : `attachment; filename="${encodeURIComponent(filename)}"`;

  return new Response(new Uint8Array(responseData), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Content-Length": responseData.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
