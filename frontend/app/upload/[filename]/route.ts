export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  deleteUploadFile,
  getAuthToken,
  sanitizeUploadFilename,
  uploadsStore,
  verifyToken,
} from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { filename: rawFilename } = await params;
    const filename = sanitizeUploadFilename(decodeURIComponent(rawFilename));

    // IDOR / Tenant isolation check: Non-admin users can only delete their own files
    const doc = uploadsStore.get(filename);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      );
    }
    if (username !== "admin" && (!doc.username || doc.username !== username)) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Access denied to requested document." },
        { status: 403 }
      );
    }

    deleteUploadFile(filename);

    logAuditEvent({
      type: "FILE_DELETED",
      severity: "INFO",
      username,
      ip: getClientIp(req),
      details: { filename },
    });

    return NextResponse.json({
      success: true,
      message: `File ${filename} deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ filename: string }> }
) {
  return DELETE(req, props);
}
