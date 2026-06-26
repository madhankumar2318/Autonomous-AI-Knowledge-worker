# backend/routes/auth.py
from fastapi import APIRouter, Form, HTTPException, Header, Query, Cookie, Response
from typing import Optional
import bcrypt
import os
import datetime
import jwt
import re
from db import get_conn, get_cursor, execute_sql

router = APIRouter(prefix="/auth", tags=["Authentication"])

JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_session_key_1234567890!")
ALGORITHM = "HS256"

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


def _is_strong_password(password: str) -> tuple[bool, str]:
    """Verify password strength: 6-15 chars, uppercase, lowercase, number, special char."""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long."
    if len(password) > 15:
        return False, "Password must be at most 15 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[^a-zA-Z0-9]", password):
        return False, "Password must contain at least one special character."
    return True, ""


def _create_access_token(username: str) -> str:
    """Create a signed JWT token that expires in 24 hours."""
    payload = {
        "sub": username,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def _decode_access_token(token: str) -> str:
    """Decode and verify access token. Returns verified username."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token signature")


def _get_username_from_auth_header(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
) -> str:
    # 1. Try cookie first (HttpOnly secure method)
    if access_token:
        try:
            return _decode_access_token(access_token)
        except Exception:
            pass  # Fall through to header verify if cookie is expired/invalid
            
    # 2. Try authorization header (Bearer token)
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token or cookie missing")
    try:
        parts = authorization.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization header format")
        token = parts[1]
        return _decode_access_token(token)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register")
def register(
    response: Response,
    username: str           = Form(...),
    password: str           = Form(...),
    name:     Optional[str] = Form(None),
    email:    Optional[str] = Form(None),
    mobile:   Optional[str] = Form(None),
):
    """
    Register a new user. Password is bcrypt-hashed before storage.
    Returns username and a signed JWT access token in response + cookie.
    """
    if not username.strip() or not password.strip():
        raise HTTPException(status_code=400, detail="Username and password are required")

    is_strong, msg = _is_strong_password(password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=msg)

    hashed = _hash_password(password)

    conn = get_conn()
    cur  = get_cursor(conn)
    try:
        execute_sql(
            cur,
            "INSERT INTO users (username, password, name, email, mobile) VALUES (?, ?, ?, ?, ?)",
            (username.strip(), hashed, name, email, mobile)
        )
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    conn.close()

    token = _create_access_token(username.strip())
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
        path="/"
    )
    return {
        "status": "success",
        "message": f"User '{username}' registered successfully",
        "username": username.strip(),
        "token": token
    }


@router.post("/login")
def login(
    response: Response,
    username: str = Form(...),
    password: str = Form(...)
):
    """
    Authenticate user. Supports both bcrypt-hashed passwords and legacy
    plain-text passwords (auto-migrates to bcrypt on first successful login).
    Returns username and a signed JWT access token in response + cookie.
    """
    conn = get_conn()
    cur  = get_cursor(conn)
    execute_sql(cur, "SELECT password FROM users WHERE username = ?", (username,))
    row = cur.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    stored = row["password"]
    authenticated = False

    # ── Legacy migration: plain-text password stored (old account) ──────────
    if _is_plain_text(stored):
        if stored == password:
            # Silently upgrade to bcrypt hash
            new_hash = _hash_password(password)
            execute_sql(cur, "UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
            conn.commit()
            authenticated = True
        conn.close()
    else:
        # ── Normal bcrypt verification ───────────────────────────────────────────
        conn.close()
        if _verify_password(password, stored):
            authenticated = True

    if not authenticated:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = _create_access_token(username)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
        path="/"
    )
    return {
        "status": "success",
        "message": "Login successful",
        "username": username,
        "token": token
    }


@router.post("/logout")
def logout(response: Response):
    """Clear the access_token HttpOnly cookie."""
    response.delete_cookie(key="access_token", path="/")
    return {"status": "success", "message": "Logged out successfully"}


@router.get("/verify")
def verify_session(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """
    Verify that a JWT token is valid and the user exists in DB.
    Reads from Cookie, Query param `token`, or Header `Authorization`.
    """
    token_to_decode = access_token or token
    if not token_to_decode and authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_to_decode = parts[1]

    if not token_to_decode:
        raise HTTPException(status_code=401, detail="Token required")

    username = _decode_access_token(token_to_decode)

    conn = get_conn()
    cur  = get_cursor(conn)
    execute_sql(cur, "SELECT username FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Session invalid")

    return {"status": "valid", "username": username}


@router.get("/profile")
def get_profile(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Fetch the full profile for the authenticated user."""
    username = _get_username_from_auth_header(authorization, access_token)
    
    conn = get_conn()
    cur  = get_cursor(conn)
    execute_sql(cur, "SELECT id, username, name, email, mobile FROM users WHERE username = ?", (username,))
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
    name:     Optional[str] = Form(None),
    email:    Optional[str] = Form(None),
    mobile:   Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Update profile fields for the authenticated user."""
    username = _get_username_from_auth_header(authorization, access_token)
    
    conn = get_conn()
    cur  = get_cursor(conn)
    execute_sql(
        cur,
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
    old_password: str = Form(...),
    new_password: str = Form(...),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Change password for the authenticated user."""
    username = _get_username_from_auth_header(authorization, access_token)
    
    is_strong, msg = _is_strong_password(new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=msg)

    conn = get_conn()
    cur  = get_cursor(conn)
    execute_sql(cur, "SELECT password FROM users WHERE username = ?", (username,))
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
    execute_sql(cur, "UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
    conn.commit()
    conn.close()

    return {"status": "success", "message": "Password changed successfully"}
