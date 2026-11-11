import { NextResponse } from "next/server";
import { getAuthToken, verifyToken, getUserRecord, setUserRecord, deleteUserRecord, UserRecord } from "@/app/lib/store";
import { getDbUser, updateDbUser } from "@/app/lib/db";
import { verifyCsrf, csrfErrorResponse } from "@/app/lib/csrf";

export async function GET(req: Request) {
  const username = verifyToken(getAuthToken(req));
  if (!username) {
    return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
  }

  // Fetch persistent user profile from database if available
  const dbUser = await getDbUser(username);
  if (dbUser) {
    setUserRecord(dbUser);
  }

  const memUser = getUserRecord(username);
  const resolvedAvatar = (dbUser?.avatar && dbUser.avatar.length > 0)
    ? dbUser.avatar
    : (memUser?.avatar && memUser.avatar.length > 0 ? memUser.avatar : "");

  const resolvedName = (dbUser?.name && dbUser.name !== "Administrator")
    ? dbUser.name
    : (memUser?.name && memUser.name !== "Administrator" ? memUser.name : (username === "admin" ? "Madhan" : username));

  const resolvedTab = (dbUser?.defaultStartingTab && dbUser.defaultStartingTab !== "news")
    ? dbUser.defaultStartingTab
    : (memUser?.defaultStartingTab || "news");

  const user: UserRecord = {
    id: dbUser?.id || memUser?.id || "admin-1",
    username,
    passwordHash: dbUser?.passwordHash || memUser?.passwordHash || "",
    name: resolvedName,
    email: dbUser?.email || memUser?.email || `${username}@knowledge-worker.local`,
    mobile: dbUser?.mobile || memUser?.mobile || "+1 555-0199",
    role: dbUser?.role || memUser?.role || (username === "admin" ? "ADMIN" : "USER"),
    avatar: resolvedAvatar,
    defaultStartingTab: resolvedTab,
    timeFormat: dbUser?.timeFormat || memUser?.timeFormat || "12h",
    dateFormat: dbUser?.dateFormat || memUser?.dateFormat || "DD/MM/YYYY",
    soundEffects: dbUser?.soundEffects ?? memUser?.soundEffects ?? true,
    tokenVersion: 1,
  };

  // Sync back to memory and disk so subsequent calls are fast and aligned
  setUserRecord(user);

  return NextResponse.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    avatar: user.avatar || "",
    defaultStartingTab: user.defaultStartingTab || "news",
    timeFormat: user.timeFormat || "12h",
    dateFormat: user.dateFormat || "DD/MM/YYYY",
    soundEffects: user.soundEffects ?? true,
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

    let user: UserRecord | null = getUserRecord(username);
    if (!user) {
      user = {
        id: "user-" + Date.now(),
        username,
        passwordHash: "",
        name: username,
        email: `${username}@example.com`,
        mobile: "",
        role: username === "admin" ? "ADMIN" : "USER",
        avatar: "",
        defaultStartingTab: "news",
        timeFormat: "12h",
        dateFormat: "DD/MM/YYYY",
        soundEffects: true,
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
    if (body.avatar !== undefined) {
      user.avatar = String(body.avatar);
    }
    if (body.defaultStartingTab !== undefined) {
      user.defaultStartingTab = String(body.defaultStartingTab).slice(0, 30);
    }
    if (body.timeFormat !== undefined) {
      user.timeFormat = String(body.timeFormat).slice(0, 10);
    }
    if (body.dateFormat !== undefined) {
      user.dateFormat = String(body.dateFormat).slice(0, 20);
    }
    if (body.soundEffects !== undefined) {
      user.soundEffects = Boolean(body.soundEffects);
    }

    setUserRecord(user);

    // Persist to Supabase PostgreSQL database
    await updateDbUser(username, {
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      avatar: user.avatar,
      defaultStartingTab: user.defaultStartingTab,
      timeFormat: user.timeFormat,
      dateFormat: user.dateFormat,
      soundEffects: user.soundEffects,
    }).catch((err) => {
      console.warn("[AUTH] Failed to persist profile updates to DB:", err);
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      avatar: user.avatar || "",
      defaultStartingTab: user.defaultStartingTab || "news",
      timeFormat: user.timeFormat || "12h",
      dateFormat: user.dateFormat || "DD/MM/YYYY",
      soundEffects: user.soundEffects ?? true,
      role: user.role,
      message: "Profile updated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update profile." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const csrfCheck = verifyCsrf(req);
    if (!csrfCheck.ok) {
      return csrfErrorResponse(csrfCheck.reason);
    }

    const username = verifyToken(getAuthToken(req));
    if (!username) {
      return NextResponse.json({ message: "Unauthorized. Please log in." }, { status: 401 });
    }

    deleteUserRecord(username);

    const response = NextResponse.json({ message: "Account deleted successfully." });
    response.cookies.delete("ak_token");
    response.cookies.delete("ak_refresh_token");
    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to delete account." }, { status: 500 });
  }
}
