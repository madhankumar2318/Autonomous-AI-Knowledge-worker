from fastapi import APIRouter, Form, HTTPException
from typing import Optional
import bcrypt
from db import get_conn

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt. Returns the hash string."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # If the stored value is an old plain-text password (migration case),
        # fall back to a direct string compare and rehash on success.
        return False


def _is_plain_text(stored: str) -> bool:
    """Returns True if the stored password is NOT a bcrypt hash (legacy plain text)."""
    return not stored.startswith("$2b$") and not stored.startswith("$2a$")


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register")
def register(
    username: str           = Form(...),
    password: str           = Form(...),
    name:     Optional[str] = Form(None),
    email:    Optional[str] = Form(None),
    mobile:   Optional[str] = Form(None),
):
    """
    Register a new user. Password is bcrypt-hashed before storage.
    """
    if not username.strip() or not password.strip():
        raise HTTPException(status_code=400, detail="Username and password are required")

    hashed = _hash_password(password)

    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password, name, email, mobile) VALUES (?, ?, ?, ?, ?)",
            (username.strip(), hashed, name, email, mobile)
        )
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    conn.close()

    return {"status": "success", "message": f"User '{username}' registered successfully"}


@router.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    """
    Authenticate user. Supports both bcrypt-hashed passwords and legacy
    plain-text passwords (auto-migrates to bcrypt on first successful login).
    """
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = ?", (username,))
    row = cur.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    stored = row["password"]

    # ── Legacy migration: plain-text password stored (old account) ──────────
    if _is_plain_text(stored):
        if stored != password:
            conn.close()
            raise HTTPException(status_code=401, detail="Invalid username or password")
        # ✅ Correct password — silently upgrade to bcrypt hash
        new_hash = _hash_password(password)
        cur.execute("UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Login successful", "username": username}

    # ── Normal bcrypt verification ───────────────────────────────────────────
    conn.close()
    if not _verify_password(password, stored):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {"status": "success", "message": "Login successful", "username": username}


@router.get("/verify")
def verify_session(username: str):
    """
    Verify that a username session is still valid (user exists in DB).
    Used by the frontend to restore a persisted login on page load.
    """
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT username FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Session invalid")

    return {"status": "valid", "username": username}


@router.get("/profile")
def get_profile(username: str):
    """Fetch the full profile for a given username."""
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, username, name, email, mobile FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id":       user["id"],
        "username": user["username"],
        "name":     user["name"]   or "",
        "email":    user["email"]  or "",
        "mobile":   user["mobile"] or "",
    }


@router.put("/profile")
def update_profile(
    username: str           = Form(...),
    name:     Optional[str] = Form(None),
    email:    Optional[str] = Form(None),
    mobile:   Optional[str] = Form(None),
):
    """Update user profile fields (name, email, mobile)."""
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "UPDATE users SET name = ?, email = ?, mobile = ? WHERE username = ?",
        (name, email, mobile, username)
    )
    conn.commit()
    rows = cur.rowcount
    conn.close()

    if rows == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "success", "message": "Profile updated successfully"}


@router.put("/password")
def change_password(
    username:     str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...),
):
    """
    Change a user's password. Verifies the current password first,
    then hashes and saves the new one using bcrypt.
    """
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = ?", (username,))
    row = cur.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    stored = row["password"]

    # Support both legacy plain-text and bcrypt-hashed passwords
    if _is_plain_text(stored):
        correct = (stored == old_password)
    else:
        correct = _verify_password(old_password, stored)

    if not correct:
        conn.close()
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Save new bcrypt hash
    new_hash = _hash_password(new_password)
    cur.execute("UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
    conn.commit()
    conn.close()

    return {"status": "success", "message": "Password changed successfully"}
