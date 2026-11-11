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
} from "@/app/lib/store";
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

    // Look up user from registry (admin is seeded with hashed password)
    const user = usersStore.get(username) || usersStore.get(username.toLowerCase());
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
      usersStore.set(username, user);
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
      usersStore.set(username, effectiveUser);
    }

    const token = generateToken(username);
    const sessionId = recordUserSession(effectiveUser.username, req);

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
