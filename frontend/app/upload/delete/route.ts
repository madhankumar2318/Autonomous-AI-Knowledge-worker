import { NextResponse } from "next/server";
import { deleteUploadFile } from "@/app/lib/store";

export async function POST(req: Request) {
  try {
    let filename = "";
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      filename = body.filename || "";
    } else {
      const url = new URL(req.url);
      filename = url.searchParams.get("filename") || "";
    }

    if (!filename) {
      const url = new URL(req.url);
      filename = url.searchParams.get("filename") || "";
    }

    if (!filename) {
      return NextResponse.json(
        { success: false, message: "Filename is required" },
        { status: 400 }
      );
    }

    deleteUploadFile(decodeURIComponent(filename));

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
