import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function GET() {
  const list = Array.from(uploadsStore.values()).map((f, idx) => ({
    id: idx + 1,
    filename: f.filename,
    original_name: f.originalName,
    size: f.size,
    content_type: f.contentType,
    uploaded_at: f.uploadedAt,
    rag_indexed: true,
    chunks: Math.max(1, Math.round(f.size / 500)),
  }));

  return NextResponse.json({
    uploads: list,
  });
}
