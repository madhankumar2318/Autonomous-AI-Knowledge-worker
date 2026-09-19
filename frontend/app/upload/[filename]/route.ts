import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  uploadsStore.delete(filename);

  return NextResponse.json({
    message: `File ${filename} deleted successfully.`,
  });
}
