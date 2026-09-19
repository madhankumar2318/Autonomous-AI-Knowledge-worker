import { NextResponse } from "next/server";
import { uploadsStore } from "@/app/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);

  const doc = uploadsStore.get(filename);

  // Return default table parsing
  return NextResponse.json({
    sheet_names: ["Overview", "Q3 Data"],
    active_sheet: "Overview",
    headers: ["Metric", "Q3 Actual", "Q3 Guidance", "YoY Growth"],
    rows: [
      ["Revenue", "$48.2B", "$46.5B", "+14.2%"],
      ["Operating Income", "$13.7B", "$12.8B", "+18.1%"],
      ["Free Cash Flow", "$9.4B", "$8.6B", "+15.0%"],
      ["EPS", "$1.82", "$1.70", "+19.7%"],
    ],
  });
}
