import { NextResponse } from "next/server";
import {
  verifyToken,
  verifyPassword,
  usersStore,
  hashPassword,
  getAuthToken,
  invalidateUserTokens,
  generateToken,
  saveUsersToDisk,
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

    let currentPassword = "";
    let newPassword = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      currentPassword = body.currentPassword || body.current_password || body.oldPassword || body.old_password || "";
      newPassword = body.newPassword || body.new_password || body.password || "";
    } else {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        currentPassword = String(
          formData.get("currentPassword") ||
          formData.get("current_password") ||
          formData.get("oldPassword") ||
          formData.get("old_password") ||
          ""
        );
        newPassword = String(
          formData.get("newPassword") ||
          formData.get("new_password") ||
          formData.get("password") ||
          ""
        );
      }
    }

    const user = usersStore.get(username) || usersStore.get(username.toLowerCase());
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (!currentPassword) {
      return NextResponse.json(
        { message: "Current password is required to change password." },
        { status: 400 }
      );
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      logAuditEvent({
        type: "AUTH_LOGIN_FAILED",
        severity: "WARN",
        username,
        ip,
        details: { action: "failed_password_change_wrong_current_password" },
      });
      return NextResponse.json(
        { message: "Current password is incorrect." },
        { status: 401 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: "New password must be at least 6 characters." }, { status: 400 });
    }

    user.passwordHash = hashPassword(newPassword);
    usersStore.set(username, user);
    usersStore.set(username.toLowerCase(), user);
    saveUsersToDisk();

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
