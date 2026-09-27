export const dynamic = "force-dynamic";

import { getUploadBuffer, getUploadRecord, uploadsStore } from "@/app/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  let doc = getUploadRecord(filename) || uploadsStore.get(filename) || uploadsStore.get(rawFilename);
  let buffer = getUploadBuffer(filename) || getUploadBuffer(rawFilename);

  if (!doc || !buffer) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetNorm = norm(filename);
    for (const [key, val] of Array.from(uploadsStore.entries())) {
      if (norm(key) === targetNorm || norm(val.filename) === targetNorm) {
        if (!doc) doc = val;
        if (!buffer) buffer = getUploadBuffer(val.filename) || getUploadBuffer(key);
        break;
      }
    }
  }

  const isPdf = filename.toLowerCase().endsWith(".pdf");

  if (!buffer && !doc) {
    return new Response("File not found", { status: 404 });
  }

  if (isPdf && !buffer) {
    return new Response("PDF binary not available on server. Use client cache or view extracted text.", {
      status: 404,
    });
  }

  const contentType =
    doc?.contentType || (isPdf ? "application/pdf" : "application/octet-stream");

  const responseData = buffer || Buffer.from(doc?.content || "", "utf-8");

  return new Response(new Uint8Array(responseData), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": responseData.length.toString(),
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
