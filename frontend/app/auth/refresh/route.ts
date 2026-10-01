import { NextResponse } from "next/server";
import { generateToken, getAuthToken, verifyToken } from "@/app/lib/store";

export async function POST(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  const newToken = generateToken(username);

  const response = NextResponse.json({
    access_token: newToken,
    token: newToken,
    token_type: "bearer",
    username,
  });

  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("ak_token", newToken, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 86400 * 7,
  });

  return response;
}
