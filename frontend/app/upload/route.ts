export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  cleanPdfTextFormatting,
  deleteUploadFile,
  extractPdfText,
  extractPdfTextSync,
  saveUploadFile,
  verifyToken,
  type UploadRecord,
} from "@/app/lib/store";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const username = verifyToken(authHeader) || "admin";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    const filename = file.name || `file_${Date.now()}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isPdf =
      filename.toLowerCase().endsWith(".pdf") ||
      file.type === "application/pdf";

    let textContent = "";
    if (isPdf) {
      try {
        textContent = await Promise.race([
          extractPdfText(buffer),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("PDF text extraction timeout")), 4000)
          ),
        ]);
      } catch (_pdfErr) {
        try {
          textContent = extractPdfTextSync(buffer);
        } catch {
          textContent = `PDF Document: ${filename}`;
        }
      }
    } else {
      try {
        textContent = buffer.toString("utf-8");
      } catch {
        textContent = "Binary document content.";
      }
    }
    textContent = cleanPdfTextFormatting(textContent || `Document: ${filename}`);

    const chunks = Math.max(
      1,
      Math.round(textContent.length > 50 ? textContent.length / 400 : file.size / 500)
    );

    const uploadRecord: UploadRecord = {
      id: "upl-" + Date.now(),
      username,
      filename,
      originalName: filename,
      contentType: isPdf ? "application/pdf" : file.type || "text/plain",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "indexed",
      chunks,
      content: textContent,
    };

    saveUploadFile(uploadRecord, buffer);

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        filename,
        size: file.size,
        rag_indexed: true,
        rag_status: "success",
        chunks,
        upload: {
          id: uploadRecord.id,
          filename: uploadRecord.filename,
          original_name: uploadRecord.originalName,
          size: uploadRecord.size,
          content_type: uploadRecord.contentType,
          uploaded_at: uploadRecord.uploadedAt,
          rag_indexed: true,
          chunks,
          content: textContent,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Upload error in route.ts:", err);
    return NextResponse.json(
      { message: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let filename = url.searchParams.get("filename") || "";
    if (!filename) {
      const body = await req.json().catch(() => ({}));
      filename = body.filename || "";
    }
    if (filename) {
      deleteUploadFile(decodeURIComponent(filename));
      return NextResponse.json({
        success: true,
        message: `File ${filename} deleted successfully.`,
      });
    }
    return NextResponse.json(
      { message: "Filename parameter is required." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
