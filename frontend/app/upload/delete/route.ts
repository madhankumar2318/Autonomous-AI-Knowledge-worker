export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { deleteUploadFile, getAuthToken, uploadsStore, verifyToken } from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    let filename = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      filename = body.filename || "";
    } else {
      const url = new URL(req.url);
      filename = url.searchParams.get("filename") || "";
    }

    if (!filename) {
      const url = new URL(req.url);
      filename = url.searchParams.get("filename") || "";
    }

    if (!filename) {
      return NextResponse.json(
        { success: false, message: "Filename is required" },
        { status: 400 }
      );
    }

    const decodedFilename = decodeURIComponent(filename);
    const doc = uploadsStore.get(decodedFilename);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      );
    }
    if (username !== "admin" && (!doc.username || doc.username !== username)) {
      return NextResponse.json(
        { success: false, message: "Forbidden. You do not have permission to delete this file." },
        { status: 403 }
      );
    }

    deleteUploadFile(decodedFilename);

    logAuditEvent({
      type: "FILE_DELETED",
      severity: "INFO",
      username,
      ip: getClientIp(req),
      details: { filename: decodedFilename },
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

export async function DELETE(req: Request) {
  return POST(req);
}
