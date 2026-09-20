import { NextResponse } from "next/server";
import { deleteUploadFile } from "@/app/lib/store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  deleteUploadFile(filename);

  return NextResponse.json({
    message: `File ${filename} deleted successfully.`,
  });
}
