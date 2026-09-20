import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  extractPdfText,
  getStorageDirs,
  uploadsStore,
} from "@/app/lib/store";

export async function GET() {
  // Check storage directories for any files not yet in uploadsStore
  for (const dir of getStorageDirs()) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith(".json")) continue;
          if (!uploadsStore.has(file)) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const isPdf = file.toLowerCase().endsWith(".pdf");
              let textContent = "";
              if (isPdf) {
                try {
                  const buf = fs.readFileSync(filePath);
                  textContent = extractPdfText(buf);
                } catch {}
              }
              const chunks = Math.max(
                1,
                Math.round(textContent.length > 50 ? textContent.length / 400 : stat.size / 500)
              );
              uploadsStore.set(file, {
                id: `upl-${file}`,
                username: "admin",
                filename: file,
                originalName: file,
                contentType: isPdf ? "application/pdf" : "text/plain",
                size: stat.size,
                uploadedAt: stat.mtime.toISOString(),
                status: "indexed",
                chunks,
                content: textContent,
              });
            }
          }
        }
      }
    } catch (_e) {}
  }

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
