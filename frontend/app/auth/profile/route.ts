import { NextResponse } from "next/server";
import { getAuthToken, verifyToken, usersStore } from "@/app/lib/store";

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

    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) user.email = body.email;
    if (body.mobile !== undefined) user.mobile = body.mobile;

    usersStore.set(username, user);

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
