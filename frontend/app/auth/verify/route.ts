import { NextResponse } from "next/server";
import { verifyToken, usersStore, UserRecord, parseUserAgent, recordUserSession } from "@/app/lib/store";
import { getDbUser, isDbSessionRevoked, recordDbSession } from "@/app/lib/db";
import { getClientIp } from "@/app/lib/rate-limiter";

function getClientSessionId(req: Request): string | null {
  const headerSid = req.headers.get("x-session-id");
  if (headerSid) return headerSid.trim();
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/ak_sid=([^;]+)/);
  if (match) return match[1].trim();
  return null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const cookieHeader = req.headers.get("cookie") || "";
  let token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;

  if (!token) {
    const match = cookieHeader.match(/ak_token=([^;]+)/);
    if (match) token = match[1];
  }

  const username = verifyToken(token);
  if (!username) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const clientSid = getClientSessionId(req);

  // Check if this device session has been revoked/logged out by another device
  if (clientSid) {
    const isRevoked = await isDbSessionRevoked(username, clientSid);
    if (isRevoked) {
      const resp = NextResponse.json(
        { valid: false, revoked: true, message: "Your session has been terminated from another device." },
        { status: 401 }
      );
      resp.cookies.delete("ak_sid");
      resp.cookies.delete("ak_token");
      return resp;
    }
  }

  // Record/refresh this device in memory and PostgreSQL so it appears in Active Devices
  const activeSid = recordUserSession(username, req, clientSid);
  const ua = req.headers.get("user-agent") || "";
  const parsedUa = parseUserAgent(ua);
  const ip = getClientIp(req);

  await recordDbSession(username, {
    id: activeSid,
    deviceType: parsedUa.deviceType,
    os: parsedUa.os,
    browser: parsedUa.browser,
    ip,
    userAgent: ua,
  }).catch(() => {});

  // Fetch persistent user profile from Supabase PostgreSQL
  const dbUser = await getDbUser(username);
  if (dbUser) {
    usersStore.set(dbUser.username, dbUser);
    usersStore.set(dbUser.username.toLowerCase(), dbUser);
  }

  const user: UserRecord = dbUser || usersStore.get(username) || usersStore.get(username.toLowerCase()) || {
    id: "user-" + Date.now(),
    username,
    passwordHash: "",
    name: username === "admin" ? "Administrator" : username,
    email: `${username}@knowledge-worker.local`,
    mobile: "+1 555-0199",
    role: username === "admin" ? "ADMIN" : "USER",
    avatar: "",
    defaultStartingTab: "news",
    timeFormat: "12h",
    dateFormat: "DD/MM/YYYY",
    soundEffects: true,
  };

  const response = NextResponse.json({
    valid: true,
    sessionId: activeSid,
    username: user.username,
    name: user.name,
    role: user.role,
    avatar: user.avatar || "",
    defaultStartingTab: user.defaultStartingTab || "news",
    timeFormat: user.timeFormat || "12h",
    dateFormat: user.dateFormat || "DD/MM/YYYY",
    soundEffects: user.soundEffects ?? true,
    user: {
      username: user.username,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      avatar: user.avatar || "",
      defaultStartingTab: user.defaultStartingTab || "news",
      timeFormat: user.timeFormat || "12h",
      dateFormat: user.dateFormat || "DD/MM/YYYY",
      soundEffects: user.soundEffects ?? true,
      role: user.role,
    },
  });

  response.cookies.set("ak_sid", activeSid, {
    path: "/",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400 * 30,
  });

  return response;
}
