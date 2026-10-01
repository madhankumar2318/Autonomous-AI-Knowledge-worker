import { NextResponse } from "next/server";
import { verifyToken, usersStore, hashPassword } from "@/app/lib/store";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";

export async function PUT(req: Request) {
  try {
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

    const authHeader = req.headers.get("Authorization");
    const username = verifyToken(authHeader);
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

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update password." }, { status: 500 });
  }
}
