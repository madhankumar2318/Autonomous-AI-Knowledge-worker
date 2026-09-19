import { NextResponse } from "next/server";
import { generateToken, verifyToken } from "@/app/lib/store";

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const username = verifyToken(authHeader) || "admin";
  const newToken = generateToken(username);

  return NextResponse.json({
    access_token: newToken,
    token: newToken,
    token_type: "bearer",
    username,
  });
}
