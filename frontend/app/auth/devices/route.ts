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

  const rawSessions = getUserSessions(username);
  const ua = req.headers.get("user-agent") || "";
  const currentParsed = parseUserAgent(ua);

  // Map sessions and identify which is current device
  const sessions = rawSessions.map((s) => {
    const isCurrent =
      s.id === activeSid ||
      s.id === clientSid ||
      (s.deviceType === currentParsed.deviceType &&
        s.os === currentParsed.os &&
        s.browser === currentParsed.browser);
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

  // Make sure at least one session is flagged as current (the active one)
  const hasCurrent = sessions.some((s) => s.isCurrent);
  if (!hasCurrent && sessions.length > 0) {
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

  if (action === "logout_device" && body.sessionId) {
    removeUserSession(username, String(body.sessionId));
    const remaining = getUserSessions(username);
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
  const remaining = getUserSessions(username);
  return NextResponse.json({
    message: "Device disconnected successfully.",
    activeCount: remaining.length,
  });
}
