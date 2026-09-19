import { NextResponse } from "next/server";
import { verifyToken, usersStore } from "@/app/lib/store";

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

  const user = usersStore.get(username) || {
    username,
    name: username === "admin" ? "Administrator" : username,
    role: username === "admin" ? "ADMIN" : "USER",
  };

  return NextResponse.json({
    valid: true,
    username: user.username,
    name: user.name,
    role: user.role,
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });
}
