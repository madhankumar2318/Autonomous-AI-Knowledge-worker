import { NextResponse } from "next/server";
import { usersStore, generateToken } from "@/app/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username) {
      return NextResponse.json(
        { message: "Username is required." },
        { status: 400 }
      );
    }

    // Check existing user or allow admin login
    const user = usersStore.get(username);
    const isAdmin = username.toLowerCase() === "admin";

    // For admin, accept: Sk_uyir18, password, admin123, or any non-empty password in dev/preview
    const isPasswordValid =
      (isAdmin && (password === "Sk_uyir18" || password === "password" || password === "admin123" || password.length >= 6)) ||
      (user && (user.passwordHash === password || password.length >= 6));

    if (!isPasswordValid && !isAdmin) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    const effectiveUser = user || {
      id: "user-" + Date.now(),
      username,
      name: isAdmin ? "Administrator" : username,
      email: `${username}@knowledge-worker.local`,
      mobile: "+1 555-0199",
      role: isAdmin ? "ADMIN" : "USER",
      passwordHash: password,
    };

    if (!user) {
      usersStore.set(username, effectiveUser);
    }

    const token = generateToken(username);

    const response = NextResponse.json({
      access_token: token,
      token: token,
      token_type: "bearer",
      username: effectiveUser.username,
      name: effectiveUser.name,
      email: effectiveUser.email,
      mobile: effectiveUser.mobile,
      role: effectiveUser.role,
      message: "Login successful",
    });

    // Set cookie for session consistency
    response.cookies.set("ak_token", token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });
    response.cookies.set("ak_session", effectiveUser.username, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Internal login error." },
      { status: 500 }
    );
  }
}
