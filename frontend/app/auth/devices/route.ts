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

  // Combine disk/memory and DB sessions
  const dbSessions = await getDbSessions(username).catch(() => []);
  const memSessions = getUserSessions(username);

  // Group by physical device: deviceType + os
  // Current requesting device always takes priority!
  const deviceMap = new Map<string, any>();

  // 1. Current requesting device:
  const currentKey = `${currentParsed.deviceType}-${currentParsed.os}`;
  deviceMap.set(currentKey, {
    id: activeSid,
    deviceType: currentParsed.deviceType,
    os: currentParsed.os,
    browser: currentParsed.browser,
    ip: ip || "127.0.0.1",
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
    isCurrent: true,
  });

  // 2. Add other unique devices from memory & db
  const allOther = [...memSessions, ...dbSessions].sort(
    (a, b) => (Number(b.lastActiveAt) || 0) - (Number(a.lastActiveAt) || 0)
  );

  for (const s of allOther) {
    if (!s || s.revoked) continue;
    // Filter out automated node test runner or unparsed sessions
    if ((s.os === "Desktop" && s.browser === "Browser") || s.userAgent?.includes("node")) continue;
    const key = `${s.deviceType}-${s.os}`;
    // If it's the current device and its ID isn't activeSid, skip it (same computer)
    if (key === currentKey) continue;
    if (deviceMap.has(key)) continue;

    deviceMap.set(key, {
      id: s.id,
      deviceType: s.deviceType || "Desktop",
      os: s.os || "Unknown",
      browser: s.browser || "Unknown",
      ip: s.ip && s.ip !== "unknown" ? s.ip : "127.0.0.1",
      lastActiveAt: Number(s.lastActiveAt) || Date.now(),
      createdAt: Number(s.createdAt) || Date.now(),
      isCurrent: false,
    });
  }

  const sessions = Array.from(deviceMap.values());

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

  const ua = req.headers.get("user-agent") || "";
  const hintType = req.headers.get("x-device-type") || undefined;
  const hintOs = req.headers.get("x-device-os") || undefined;
  const hintBrowser = req.headers.get("x-device-browser") || undefined;
  const currentParsed = parseUserAgent(ua, hintType);
  if (hintOs) currentParsed.os = hintOs;
  if (hintBrowser) currentParsed.browser = hintBrowser;
  const ip = getClientIp(req);
  const currentKey = `${currentParsed.deviceType}-${currentParsed.os}`;

  if (action === "logout_others") {
    // Keep only the current session active
    const activeSid = recordUserSession(username, req, clientSid);
    removeOtherUserSessions(username, activeSid);
    await removeOtherDbSessions(username, activeSid).catch(() => {});

    const sessions = [
      {
        id: activeSid,
        deviceType: currentParsed.deviceType,
        os: currentParsed.os,
        browser: currentParsed.browser,
        ip: ip || "127.0.0.1",
        lastActiveAt: Date.now(),
        createdAt: Date.now(),
        isCurrent: true,
      },
    ];

    return NextResponse.json({
      message: "Logged out of all other active sessions.",
      activeCount: 1,
      sessions,
    });
  }

  if (action === "logout_device" && (body.sessionId || body.targetSessionId)) {
    const targetSid = String(body.sessionId || body.targetSessionId);
    removeUserSession(username, targetSid);
    await removeDbSession(username, targetSid).catch(() => {});

    const dbSessions = await getDbSessions(username).catch(() => []);
    const memSessions = getUserSessions(username);

    const deviceMap = new Map<string, any>();
    deviceMap.set(currentKey, {
      id: clientSid || "current",
      deviceType: currentParsed.deviceType,
      os: currentParsed.os,
      browser: currentParsed.browser,
      ip: ip || "127.0.0.1",
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      isCurrent: true,
    });

    for (const s of [...memSessions, ...dbSessions]) {
      if (!s || s.revoked || s.id === targetSid) continue;
      if ((s.os === "Desktop" && s.browser === "Browser") || s.userAgent?.includes("node")) continue;
      const key = `${s.deviceType}-${s.os}`;
      if (key === currentKey || deviceMap.has(key)) continue;
      deviceMap.set(key, {
        id: s.id,
        deviceType: s.deviceType || "Desktop",
        os: s.os || "Unknown",
        browser: s.browser || "Unknown",
        ip: s.ip && s.ip !== "unknown" ? s.ip : "127.0.0.1",
        lastActiveAt: Number(s.lastActiveAt) || Date.now(),
        createdAt: Number(s.createdAt) || Date.now(),
        isCurrent: false,
      });
    }

    const sessions = Array.from(deviceMap.values());
    return NextResponse.json({
      message: "Device session removed.",
      activeCount: sessions.length,
      sessions,
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
