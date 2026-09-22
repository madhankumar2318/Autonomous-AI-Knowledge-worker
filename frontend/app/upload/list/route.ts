import { NextResponse } from "next/server";
import {
  syncUploadsFromDisk,
  uploadsStore,
} from "@/app/lib/store";

export async function GET() {
  // Sync all persistent records and disk files
  syncUploadsFromDisk();

  const list = Array.from(uploadsStore.values()).map((f, idx) => ({
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

  return NextResponse.json({
    uploads: list,
  });
}
