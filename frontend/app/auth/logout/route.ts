import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.delete("ak_token");
  response.cookies.delete("ak_session");
  return response;
}
