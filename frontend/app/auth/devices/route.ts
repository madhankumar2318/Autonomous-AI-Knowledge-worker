import { NextResponse } from "next/server";
import {
  getAuthToken,
  verifyToken,
  getUserSessions,
  recordUserSession,
  removeUserSession,
  removeOtherUserSessions,
  parseUserAgent,
} from "@/app/lib/store";
import {
  recordDbSession,
  getDbSessions,
  removeDbSession,
  removeOtherDbSessions,
} from "@/app/lib/db";
import { getClientIp } from "@/app/lib/rate-limiter";

function getClientSessionId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/ak_sid=([^;]+)/);
  if (match) return match[1];
  const headerSid = req.headers.get("x-session-id");
  if (headerSid) return headerSid;
  return null;
}

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  // Ensure current device session is recorded/refreshed
  const clientSid = getClientSessionId(req);
  const activeSid = recordUserSession(username, req, clientSid);

  const ua = req.headers.get("user-agent") || "";
  const hintType = req.headers.get("x-device-type") || undefined;
  const hintOs = req.headers.get("x-device-os") || undefined;
  const hintBrowser = req.headers.get("x-device-browser") || undefined;

  const currentParsed = parseUserAgent(ua, hintType);
  if (hintOs) currentParsed.os = hintOs;
  if (hintBrowser) currentParsed.browser = hintBrowser;
  const ip = getClientIp(req);

  // Persist session to PostgreSQL if available
  await recordDbSession(username, {
    id: activeSid,
    deviceType: currentParsed.deviceType,
    os: currentParsed.os,
    browser: currentParsed.browser,
    ip,
    userAgent: ua,
  }).catch((err) => {
    console.warn("[DEVICES] Failed to record DB session:", err);
  });

  // Retrieve persistent sessions from disk and DB
  const dbSessions = await getDbSessions(username).catch(() => []);
  const memSessions = getUserSessions(username);

  const sessionMap = new Map<string, any>();
  for (const s of memSessions) {
    sessionMap.set(s.id, s);
  }
  for (const s of dbSessions) {
    if (!sessionMap.has(s.id)) {
      sessionMap.set(s.id, s);
    }
  }

  const rawSessions = Array.from(sessionMap.values()).sort(
    (a, b) => (Number(b.lastActiveAt) || 0) - (Number(a.lastActiveAt) || 0)
  );

  // Accurately identify which session is the current requesting device
  let matchedCurrent = false;
  const sessions = rawSessions.map((s) => {
    const isCurrent =
      !matchedCurrent &&
      (s.id === activeSid || (Boolean(clientSid) && s.id === clientSid));
    if (isCurrent) matchedCurrent = true;
    return {
      id: s.id,
      deviceType: s.deviceType || "Desktop",
      os: s.os || "Unknown",
      browser: s.browser || "Unknown",
      ip: s.ip || ip || "127.0.0.1",
      lastActiveAt: Number(s.lastActiveAt) || Date.now(),
      createdAt: Number(s.createdAt) || Date.now(),
      isCurrent,
    };
  });

  // If no exact match was found, flag the active one as current
  if (!matchedCurrent && sessions.length > 0) {
    sessions[0].isCurrent = true;
  }

  const response = NextResponse.json({
    sessions,
    currentSessionId: activeSid,
  });

  // Re-affirm ak_sid cookie for client identification
  response.cookies.set("ak_sid", activeSid, {
    path: "/",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400 * 7,
  });

  return response;
}

export async function POST(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "";
  const clientSid = getClientSessionId(req) || body.currentSessionId || "";

  if (action === "logout_others") {
    // Keep only the current session active
    const activeSid = recordUserSession(username, req, clientSid);
    removeOtherUserSessions(username, activeSid);
    await removeOtherDbSessions(username, activeSid).catch(() => {});

    const remaining = getUserSessions(username);
    return NextResponse.json({
      message: "Logged out of all other active sessions.",
      activeCount: remaining.length,
      sessions: remaining.map((s) => ({
        ...s,
        isCurrent: s.id === activeSid,
      })),
    });
  }

  if (action === "logout_device" && (body.sessionId || body.targetSessionId)) {
    const targetSid = String(body.sessionId || body.targetSessionId);
    removeUserSession(username, targetSid);
    await removeDbSession(username, targetSid).catch(() => {});

    const remaining = getUserSessions(username);
    return NextResponse.json({
      message: "Device session removed.",
      activeCount: remaining.length,
      sessions: remaining.map((s) => ({
        ...s,
        isCurrent: s.id === clientSid,
      })),
    });
  }

  return NextResponse.json({ message: "Invalid action." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "Session ID required." }, { status: 400 });
  }

  removeUserSession(username, sessionId);
  await removeDbSession(username, sessionId).catch(() => {});

  const dbSessions = await getDbSessions(username);
  const remaining = dbSessions.length > 0 ? dbSessions : getUserSessions(username);
  return NextResponse.json({
    message: "Device disconnected successfully.",
    activeCount: remaining.length,
  });
}
