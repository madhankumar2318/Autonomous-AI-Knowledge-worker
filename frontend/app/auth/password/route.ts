import { NextResponse } from "next/server";
import {
  verifyToken,
  usersStore,
  hashPassword,
  getAuthToken,
  invalidateUserTokens,
  generateToken,
} from "@/app/lib/store";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";
import { logAuditEvent } from "@/app/lib/audit-logger";

export async function PUT(req: Request) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const ip = getClientIp(req);
    // Rate limit: 5 password changes per 10 minutes per IP
    const rateLimit = checkRateLimit(`password_change:${ip}`, 5, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Too many password change attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const token = getAuthToken(req);
    const username = verifyToken(token);
    if (!username) {
      return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    const newPassword = body.newPassword || body.password;
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
    }

    const user = usersStore.get(username);
    if (user) {
      user.passwordHash = hashPassword(newPassword);
      usersStore.set(username, user);
    }

    // Invalidate all previously issued tokens for this account across all devices
    invalidateUserTokens(username);
    const freshToken = generateToken(username);

    logAuditEvent({
      type: "PASSWORD_CHANGED",
      severity: "INFO",
      username,
      ip,
      details: { message: "User password updated successfully and previous session tokens invalidated" },
    });

    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      message: "Password updated successfully. Other sessions invalidated.",
      access_token: freshToken,
      token: freshToken,
    });

    response.cookies.set("ak_token", freshToken, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update password." }, { status: 500 });
  }
}
