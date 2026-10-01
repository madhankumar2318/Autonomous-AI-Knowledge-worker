export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { deleteUploadFile, getAuthToken, sanitizeUploadFilename, verifyToken } from "@/app/lib/store";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { filename: rawFilename } = await params;
    const filename = sanitizeUploadFilename(decodeURIComponent(rawFilename));

    deleteUploadFile(filename);

    return NextResponse.json({
      success: true,
      message: `File ${filename} deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ filename: string }> }
) {
  return DELETE(req, props);
}
