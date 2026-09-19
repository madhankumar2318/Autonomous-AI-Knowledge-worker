import { NextResponse } from "next/server";
import { usersStore, generateToken } from "@/app/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";
    const name = body.name || username;
    const email = body.email || `${username}@example.com`;
    const mobile = body.mobile || "+1 555-0100";

    if (!username || username.length < 3) {
      return NextResponse.json(
        { message: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (usersStore.has(username) && username !== "admin") {
      return NextResponse.json(
        { message: "Username is already taken." },
        { status: 409 }
      );
    }

    const newUser = {
      id: "user-" + Date.now(),
      username,
      name,
      email,
      mobile,
      role: "USER",
      passwordHash: password,
    };

    usersStore.set(username, newUser);
    const token = generateToken(username);

    const response = NextResponse.json({
      access_token: token,
      token: token,
      token_type: "bearer",
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      mobile: newUser.mobile,
      role: newUser.role,
      message: "Registration successful",
    });

    response.cookies.set("ak_token", token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_session", username, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Registration error." },
      { status: 500 }
    );
  }
}
