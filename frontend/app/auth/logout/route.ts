import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.set("ak_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("ak_session", "", { path: "/", maxAge: 0 });
  return response;
}
