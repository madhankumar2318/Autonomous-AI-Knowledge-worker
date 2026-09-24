import { NextResponse } from "next/server";
import {
  cleanPdfTextFormatting,
  extractPdfText,
  getUploadBuffer,
  saveUploadFile,
  uploadsStore,
} from "@/app/lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  let doc = uploadsStore.get(filename);
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
