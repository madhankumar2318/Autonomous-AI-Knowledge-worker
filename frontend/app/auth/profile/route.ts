import { NextResponse } from "next/server";
import { getAuthToken, verifyToken, usersStore, saveUsersToDisk } from "@/app/lib/store";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }
  const user = usersStore.get(username) || {
    id: "admin-1",
    username: "admin",
    name: "Administrator",
    email: "admin@knowledge-worker.local",
    mobile: "+1 555-0199",
    role: "ADMIN",
  };

  return NextResponse.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    accountNonLocked: true,
  });
}

export async function PUT(req: Request) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    let user = usersStore.get(username);
    if (!user) {
      user = {
        id: "user-" + Date.now(),
        username,
        passwordHash: "",
        name: username,
        email: `${username}@example.com`,
        mobile: "",
        role: username === "admin" ? "ADMIN" : "USER",
      };
    }

    if (body.name !== undefined) {
      user.name = String(body.name).replace(/[\r\n\t]/g, " ").trim().slice(0, 80);
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().slice(0, 120);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
      }
      user.email = email;
    }
    if (body.mobile !== undefined) {
      const mobile = String(body.mobile).replace(/[\r\n\t]/g, "").trim().slice(0, 25);
      if (mobile && !/^[0-9+\-()\s]{0,25}$/.test(mobile)) {
        return NextResponse.json({ message: "Invalid mobile phone number format." }, { status: 400 });
      }
      user.mobile = mobile;
    }

    usersStore.set(username, user);
    usersStore.set(username.toLowerCase(), user);
    saveUsersToDisk();

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      message: "Profile updated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update profile." }, { status: 500 });
  }
}
