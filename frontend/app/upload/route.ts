import { NextResponse } from "next/server";
import {
  deleteUploadFile,
  extractPdfText,
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
      textContent = await extractPdfText(buffer);
    } else {
      try {
        textContent = buffer.toString("utf-8");
      } catch {
        textContent = "Binary document content.";
      }
    }

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

    return NextResponse.json({
      message: "File uploaded successfully",
      filename,
      size: file.size,
      rag_indexed: true,
      rag_status: "success",
      chunks,
    });
  } catch (err: any) {
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
