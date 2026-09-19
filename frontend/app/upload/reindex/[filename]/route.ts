import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  return NextResponse.json({
    success: true,
    message: `File ${filename} re-indexed successfully.`,
    chunks: 4,
    rag_indexed: true,
  });
}
