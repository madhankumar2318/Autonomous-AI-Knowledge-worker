import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  const doc = uploadsStore.get(filename);
  if (!doc) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  return NextResponse.json({
    content: doc.content || "",
    filename: doc.filename,
    size: doc.size,
  });
}
