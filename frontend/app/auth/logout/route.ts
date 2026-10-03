import { NextResponse } from "next/server";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { getAuthToken, verifyToken, invalidateUserTokens, saveUsersToDisk } from "@/app/lib/store";
import { logAuditEvent } from "@/app/lib/audit-logger";
import { getClientIp } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  const csrfCheck = verifyCsrf(req);
  if (!csrfCheck.ok) {
    return csrfErrorResponse(csrfCheck.reason);
  }

  const username = verifyToken(getAuthToken(req));
  if (username) {
    invalidateUserTokens(username);
    saveUsersToDisk();
    logAuditEvent({
      type: "AUTH_LOGOUT",
      severity: "INFO",
      username,
      ip: getClientIp(req),
      details: { action: "session_terminated_tokens_revoked" },
    });
  }

  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.set("ak_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("ak_session", "", { path: "/", maxAge: 0 });
  return response;
}

