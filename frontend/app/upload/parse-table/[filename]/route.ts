import { NextResponse } from "next/server";
import { getAuthToken, sanitizeCsvCell, uploadsStore, verifyToken } from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  // If document exists, verify tenant access
  const doc = uploadsStore.get(filename);
  if (doc && doc.username && doc.username !== username && username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Access denied." }, { status: 403 });
  }

  const rawHeaders = ["Metric", "Q3 Actual", "Q3 Guidance", "YoY Growth"];
  const rawRows = [
    ["Revenue", "$48.2B", "$46.5B", "+14.2%"],
    ["Operating Income", "$13.7B", "$12.8B", "+18.1%"],
    ["Free Cash Flow", "$9.4B", "$8.6B", "+15.0%"],
    ["EPS", "$1.82", "$1.70", "+19.7%"],
  ];

  // Sanitize all cells against CSV / Spreadsheet formula injection
  const headers = rawHeaders.map((h) => sanitizeCsvCell(h));
  const rows = rawRows.map((r) => r.map((c) => sanitizeCsvCell(c)));

  return NextResponse.json({
    sheet_names: ["Overview", "Q3 Data"],
    active_sheet: "Overview",
    headers,
    rows,
  });
}
