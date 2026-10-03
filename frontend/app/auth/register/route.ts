import { NextResponse } from "next/server";
import { usersStore, generateToken, hashPassword, saveUsersToDisk } from "@/app/lib/store";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Rate limit: 6 registration attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(`register:${ip}`, 6, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Too many registration attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";
    const name = body.name || username;
    const email = body.email || `${username}@example.com`;
    const mobile = body.mobile || "+1 555-0100";

    if (!username || username.length < 3) {
      return NextResponse.json(
        { message: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normUsername = username.toLowerCase();
    if (usersStore.has(username) || usersStore.has(normUsername) || normUsername === "admin") {
      return NextResponse.json(
        { message: "Username is reserved or already taken." },
        { status: 409 }
      );
    }

    const newUser = {
      id: "user-" + Date.now(),
      username,
      name,
      email,
      mobile,
      role: "USER",
      passwordHash: hashPassword(password),
      tokenVersion: 1,
    };

    usersStore.set(username, newUser);
    saveUsersToDisk();
    const token = generateToken(username);

    const response = NextResponse.json({
      access_token: token,
      token: token,
      token_type: "bearer",
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      mobile: newUser.mobile,
      role: newUser.role,
      message: "Registration successful",
    });

    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set("ak_token", token, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_session", username, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Registration error." },
      { status: 500 }
    );
  }
}
