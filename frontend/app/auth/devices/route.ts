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
  const headerSid = req.headers.get("x-session-id");
  if (headerSid) return headerSid.trim();
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/ak_sid=([^;]+)/);
  if (match) return match[1].trim();
  return null;
}

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  // Ensure current device session is recorded/refreshed in memory
  const clientSid = getClientSessionId(req);
  const activeSid = recordUserSession(username, req, clientSid);

  const ua = req.headers.get("user-agent") || "";
  const currentParsed = parseUserAgent(ua);
  const ip = getClientIp(req);

  // Persist session to Supabase PostgreSQL for cross-device visibility
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

  // Retrieve persistent sessions from Supabase PostgreSQL
  const dbSessions = await getDbSessions(username);
  const rawSessions = dbSessions.length > 0 ? dbSessions : getUserSessions(username);

  // Identify which session is the current requesting device
  const targetSid = clientSid || activeSid;
  let matchedCurrent = false;

  const sessions = rawSessions.map((s) => {
    let isCurrent = false;
    if (!matchedCurrent) {
      if (s.id === targetSid || s.id === activeSid || (clientSid && s.id === clientSid)) {
        isCurrent = true;
        matchedCurrent = true;
      }
    }
    return {
      id: s.id,
      deviceType: s.deviceType,
      os: s.os,
      browser: s.browser,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent,
    };
  });

  // If no exact ID matched yet, match by deviceType and OS
  if (!matchedCurrent && sessions.length > 0) {
    const idx = sessions.findIndex(
      (s) => s.deviceType === currentParsed.deviceType && s.os === currentParsed.os
    );
    if (idx !== -1) {
      sessions[idx].isCurrent = true;
      matchedCurrent = true;
    } else {
      sessions[0].isCurrent = true;
    }
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

    const dbSessions = await getDbSessions(username);
    const remaining = dbSessions.length > 0 ? dbSessions : getUserSessions(username);
    return NextResponse.json({
      message: "Logged out of all other active sessions.",
      activeCount: remaining.length,
      sessions: remaining.map((s) => ({
        ...s,
        isCurrent: s.id === activeSid,
      })),
    });
  }

  if (action === "logout_device" && body.sessionId) {
    const targetSid = String(body.sessionId);
    removeUserSession(username, targetSid);
    await removeDbSession(username, targetSid).catch(() => {});

    const dbSessions = await getDbSessions(username);
    const remaining = dbSessions.length > 0 ? dbSessions : getUserSessions(username);
    return NextResponse.json({
      message: "Device session removed.",
      activeCount: remaining.length,
      sessions: remaining,
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
