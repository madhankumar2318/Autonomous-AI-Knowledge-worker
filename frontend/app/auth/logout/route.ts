import { NextResponse } from "next/server";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";

export async function POST(req: Request) {
  const csrfCheck = verifyCsrf(req);
  if (!csrfCheck.ok) {
    return csrfErrorResponse(csrfCheck.reason);
  }

  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.set("ak_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("ak_session", "", { path: "/", maxAge: 0 });
  return response;
}
