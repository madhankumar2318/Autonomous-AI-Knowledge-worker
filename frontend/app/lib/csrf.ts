import { NextResponse } from "next/server";
import { logAuditEvent } from "./audit-logger";
import { getClientIp } from "./rate-limiter";

/**
 * Validates Cross-Site Request Forgery (CSRF) defenses on mutating HTTP requests.
 * Following OWASP CSRF Defense Guidelines:
 * 1. Safe methods (GET, HEAD, OPTIONS) bypass CSRF checks.
 * 2. API requests presenting an explicit Bearer Authorization header bypass browser CSRF,
 *    as cross-origin scripts/forms cannot forge Authorization headers without preflight.
 * 3. Browser requests relying on cookies must pass Origin/Referer verification,
 *    Sec-Fetch-Site validation, or Custom Request Header (X-Requested-With / X-AKW-CSRF).
 */
export function verifyCsrf(req: Request): { ok: boolean; reason?: string } {
  const method = req.method.toUpperCase();

  // 1. Safe HTTP methods do not mutate state
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { ok: true };
  }

  // 2. Explicit Authorization header verifies an authorized API client (not ambient cookie)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.trim().toLowerCase().startsWith("bearer ")) {
    return { ok: true };
  }

  // 3. Inspect Sec-Fetch-Site (modern browser defense against cross-site requests)
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite.toLowerCase() === "cross-site") {
    const ip = getClientIp(req);
    logAuditEvent({
      type: "CSRF_BLOCKED",
      severity: "WARN",
      ip,
      details: { method, secFetchSite, path: req.url },
    });
    return { ok: false, reason: "Cross-site request blocked by Sec-Fetch-Site policy." };
  }

  // 4. Custom Request Header validation (X-Requested-With or X-AKW-CSRF)
  const xRequestedWith = req.headers.get("x-requested-with");
  const xCsrf = req.headers.get("x-akw-csrf") || req.headers.get("x-csrf-token");
  if (xRequestedWith || xCsrf) {
    return { ok: true };
  }

  // 5. Origin / Referer validation against Host
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost.toLowerCase() === host.toLowerCase()) {
        return { ok: true };
      }
    } catch {}
  }

  if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost.toLowerCase() === host.toLowerCase()) {
        return { ok: true };
      }
    } catch {}
  }

  // If none of the defenses matched for a mutating cookie-based request, reject as potential CSRF
  // But allow standard same-origin requests during local development when origin/referer might be omitted
  const userAgent = req.headers.get("user-agent") || "";
  const isPostmanOrCurl = !origin && !referer && (userAgent.includes("curl") || userAgent.includes("Postman"));
  if (isPostmanOrCurl) {
    return { ok: true };
  }

  // If origin/referer are completely missing in browser context, require custom header
  if (!origin && !referer && process.env.NODE_ENV !== "production") {
    return { ok: true }; // Permissive in local dev if no browser origin headers
  }

  const ip = getClientIp(req);
  logAuditEvent({
    type: "CSRF_BLOCKED",
    severity: "WARN",
    ip,
    details: { method, host, origin, referer, path: req.url },
  });

  return {
    ok: false,
    reason: "Invalid or missing CSRF verification. Please provide X-AKW-CSRF or X-Requested-With header.",
  };
}

export function csrfErrorResponse(reason = "CSRF verification failed."): NextResponse {
  return NextResponse.json({ message: reason, error: "CSRF_REJECTED" }, { status: 403 });
}
