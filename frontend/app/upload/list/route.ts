export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import {
  getAuthToken,
  syncUploadsFromDisk,
  uploadsStore,
  verifyToken,
} from "@/app/lib/store";

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json(
      { message: "Unauthorized. Please log in to view documents." },
      { status: 401 }
    );
  }

  // Sync all persistent records and disk files
  syncUploadsFromDisk();

  // Tenant isolation: non-admin users only see their own files; admin sees all
  const filteredUploads = Array.from(uploadsStore.values()).filter(
    (f) => username === "admin" || !f.username || f.username === username
  );

  const list = filteredUploads.map((f, idx) => ({
    id: idx + 1,
    filename: f.filename,
    original_name: f.originalName,
    size: f.size,
    content_type: f.contentType,
    uploaded_at: f.uploadedAt,
    rag_indexed: f.status === "indexed",
    chunks:
      f.chunks ||
      Math.max(
        1,
        Math.round(
          (f.content && f.content.length > 50 ? f.content.length / 400 : f.size / 500)
        )
      ),
  }));

  return NextResponse.json(
    {
      uploads: list,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
