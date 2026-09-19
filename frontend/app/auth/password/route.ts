import { NextResponse } from "next/server";
import { verifyToken, usersStore } from "@/app/lib/store";

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const username = verifyToken(authHeader) || "admin";
    const body = await req.json().catch(() => ({}));

    const newPassword = body.newPassword || body.password;
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
    }

    const user = usersStore.get(username);
    if (user) {
      user.passwordHash = newPassword;
      usersStore.set(username, user);
    }

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update password." }, { status: 500 });
  }
}
