import { NextResponse } from "next/server";
import { verifyToken, getUserRecord, setUserRecord, UserRecord } from "@/app/lib/store";
import { getDbUser } from "@/app/lib/db";

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

  // Check if session was revoked remotely
  const { decodeTokenPayload, revokedSessionsStore } = await import("@/app/lib/store");
  const { isDbSessionRevoked } = await import("@/app/lib/db");
  const payload = decodeTokenPayload(token);
  const sid = payload?.sid || req.headers.get("x-session-id");
  if (sid) {
    if (revokedSessionsStore.has(sid)) {
      return NextResponse.json({ valid: false, message: "Session revoked" }, { status: 401 });
    }
    const isRevoked = await isDbSessionRevoked(username, sid);
    if (isRevoked) {
      revokedSessionsStore.add(sid);
      return NextResponse.json({ valid: false, message: "Session revoked" }, { status: 401 });
    }
  }

  // Fetch persistent user profile from database if available
  const dbUser = await getDbUser(username);
  if (dbUser) {
    setUserRecord(dbUser);
  }

  const memUser = getUserRecord(username);
  const resolvedAvatar = (dbUser?.avatar && dbUser.avatar.length > 0)
    ? dbUser.avatar
    : (memUser?.avatar && memUser.avatar.length > 0 ? memUser.avatar : "");

  const resolvedName = (dbUser?.name && dbUser.name !== "Administrator")
    ? dbUser.name
    : (memUser?.name && memUser.name !== "Administrator" ? memUser.name : (username === "admin" ? "Madhan" : username));

  const resolvedTab = (dbUser?.defaultStartingTab && dbUser.defaultStartingTab !== "news")
    ? dbUser.defaultStartingTab
    : (memUser?.defaultStartingTab || "news");

  const user: UserRecord = {
    id: dbUser?.id || memUser?.id || "user-" + Date.now(),
    username,
    passwordHash: dbUser?.passwordHash || memUser?.passwordHash || "",
    name: resolvedName,
    email: dbUser?.email || memUser?.email || `${username}@knowledge-worker.local`,
    mobile: dbUser?.mobile || memUser?.mobile || "+1 555-0199",
    role: dbUser?.role || memUser?.role || (username === "admin" ? "ADMIN" : "USER"),
    avatar: resolvedAvatar,
    defaultStartingTab: resolvedTab,
    timeFormat: dbUser?.timeFormat || memUser?.timeFormat || "12h",
    dateFormat: dbUser?.dateFormat || memUser?.dateFormat || "DD/MM/YYYY",
    soundEffects: dbUser?.soundEffects ?? memUser?.soundEffects ?? true,
    tokenVersion: 1,
  };

  return NextResponse.json({
    valid: true,
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
}
