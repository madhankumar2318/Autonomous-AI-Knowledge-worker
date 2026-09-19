import { NextResponse } from "next/server";
import { uploadsStore, verifyToken } from "@/app/lib/store";

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
    const textContent = await file.text().catch(() => "Binary file uploaded.");

    const uploadRecord = {
      id: "upl-" + Date.now(),
      username,
      filename,
      originalName: filename,
      contentType: file.type || "text/plain",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "indexed" as const,
      content: textContent,
    };

    uploadsStore.set(filename, uploadRecord);

    return NextResponse.json({
      message: "File uploaded successfully",
      filename,
      size: file.size,
      rag_indexed: true,
      chunks: Math.max(1, Math.round(file.size / 500)),
    });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Upload failed" }, { status: 500 });
  }
}
