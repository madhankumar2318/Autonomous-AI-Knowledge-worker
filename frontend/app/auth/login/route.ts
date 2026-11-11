import { NextResponse } from "next/server";
import {
  UserRecord,
  usersStore,
  generateToken,
  hashPassword,
  verifyPassword,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  recordUserSession,
  parseUserAgent,
  getUserRecord,
  setUserRecord,
} from "@/app/lib/store";
import { getDbUser, recordDbSession } from "@/app/lib/db";
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limiter";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Rate limit: 10 login attempts per 5 minutes per IP
    const rateLimit = checkRateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          message: `Too many login attempts from this IP. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required." },
        { status: 400 }
      );
    }

    // Check account lockout status (Brute-Force defense by username)
    const lockStatus = isAccountLocked(username);
    if (lockStatus.locked) {
      return NextResponse.json(
        {
          message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${Math.ceil(lockStatus.remainingSeconds / 60)} minutes (${lockStatus.remainingSeconds}s).`,
          error: "ACCOUNT_LOCKED",
        },
        {
          status: 423, // Locked
          headers: {
            "Retry-After": String(lockStatus.remainingSeconds),
          },
        }
      );
    }

    // Look up user from database or memory registry (with disk sync)
    const dbUser = await getDbUser(username);
    if (dbUser) {
      setUserRecord(dbUser);
    }
    const user = dbUser || getUserRecord(username);
    const isAdmin = username.toLowerCase() === "admin";

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = verifyPassword(password, user.passwordHash);
    }

    if (!isPasswordValid) {
      const failureRecord = recordFailedLogin(username, ip);
      if (failureRecord.locked) {
        return NextResponse.json(
          {
            message: `Account has been locked for 15 minutes due to 5 consecutive failed attempts.`,
            error: "ACCOUNT_LOCKED",
          },
          {
            status: 423,
            headers: {
              "Retry-After": String(failureRecord.remainingSeconds),
            },
          }
        );
      }
      const attemptsLeft = 5 - failureRecord.attempts;
      return NextResponse.json(
        {
          message: `Invalid username or password. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before temporary account lockout.`,
        },
        { status: 401 }
      );
    }

    // Successful login: reset attempts and record audit event
    recordSuccessfulLogin(username, ip);

    // Upgrade plaintext legacy password to salted scrypt hash
    if (user && !user.passwordHash.startsWith("scrypt:")) {
      user.passwordHash = hashPassword(password);
      setUserRecord(user);
    }

    const effectiveUser: UserRecord = user || {
      id: "user-" + Date.now(),
      username,
      name: isAdmin ? "Administrator" : username,
      email: `${username}@knowledge-worker.local`,
      mobile: "+1 555-0199",
      role: isAdmin ? "ADMIN" : "USER",
      passwordHash: hashPassword(password),
      tokenVersion: 1,
      avatar: "",
      defaultStartingTab: "news",
      timeFormat: "12h",
      dateFormat: "DD/MM/YYYY",
      soundEffects: true,
    };

    if (!user) {
      setUserRecord(effectiveUser);
    }

    // Distinct device session registration
    const sessionId = recordUserSession(effectiveUser.username, req);
    const token = generateToken(effectiveUser.username, sessionId);

    // Record session in PostgreSQL for cross-device visibility if configured
    const ua = req.headers.get("user-agent") || "";
    const parsedUa = parseUserAgent(ua, req.headers.get("x-device-type") || undefined);
    await recordDbSession(effectiveUser.username, {
      id: sessionId,
      deviceType: parsedUa.deviceType,
      os: parsedUa.os,
      browser: parsedUa.browser,
      ip,
      userAgent: ua,
    }).catch((err) => {
      console.warn("[AUTH] Failed to persist session in DB:", err);
    });

    const response = NextResponse.json({
      access_token: token,
      token: token,
      token_type: "bearer",
      session_id: sessionId,
      sessionId: sessionId,
      username: effectiveUser.username,
      name: effectiveUser.name,
      email: effectiveUser.email,
      mobile: effectiveUser.mobile,
      role: effectiveUser.role,
      avatar: effectiveUser.avatar || "",
      defaultStartingTab: effectiveUser.defaultStartingTab || "news",
      timeFormat: effectiveUser.timeFormat || "12h",
      dateFormat: effectiveUser.dateFormat || "DD/MM/YYYY",
      soundEffects: effectiveUser.soundEffects ?? true,
      message: "Login successful",
    });

    const isProd = process.env.NODE_ENV === "production";
    // Set secure cookies for session consistency
    response.cookies.set("ak_token", token, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_sid", sessionId, {
      path: "/",
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_session", effectiveUser.username, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_sid", sessionId, {
      path: "/",
      httpOnly: false, // Accessible to client so it can identify "This Device"
      secure: isProd,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Internal login error." },
      { status: 500 }
    );
  }
}
