import { NextResponse } from "next/server";
import { verifyToken, usersStore, UserRecord } from "@/app/lib/store";
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
