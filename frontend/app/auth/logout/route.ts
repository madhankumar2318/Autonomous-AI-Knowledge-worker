import { NextResponse } from "next/server";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { getAuthToken, verifyToken, removeUserSession } from "@/app/lib/store";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  const csrfCheck = verifyCsrf(req);
  if (!csrfCheck.ok) {
    return csrfErrorResponse(csrfCheck.reason);
  }

  const username = verifyToken(getAuthToken(req));
  if (username) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/ak_sid=([^;]+)/);
    if (match) {
      removeUserSession(username, match[1]);
    }
    logAuditEvent({
      type: "AUTH_LOGOUT",
      severity: "INFO",
      username,
      ip: getClientIp(req),
      details: { action: "device_session_terminated" },
    });
  }

  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.set("ak_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("ak_session", "", { path: "/", maxAge: 0 });
  response.cookies.set("ak_sid", "", { path: "/", maxAge: 0 });
  return response;
}

