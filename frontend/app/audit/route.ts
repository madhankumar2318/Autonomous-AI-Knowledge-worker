import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/app/lib/store";
import { getRecentAuditLogs } from "@/app/lib/audit-logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  // Admin-only access to security audit telemetry
  if (username !== "admin") {
    return NextResponse.json({ message: "Forbidden. Admin access required." }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));
  const logs = getRecentAuditLogs(limit);

  return NextResponse.json({
    total: logs.length,
    events: logs,
  });
}
