import { getUploadBuffer, uploadsStore } from "@/app/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  const doc = uploadsStore.get(filename) || uploadsStore.get(rawFilename);
  const buffer = getUploadBuffer(filename) || getUploadBuffer(rawFilename);

  if (!buffer && !doc) {
    return new Response("File not found", { status: 404 });
  }

  const isPdf = filename.toLowerCase().endsWith(".pdf");
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
