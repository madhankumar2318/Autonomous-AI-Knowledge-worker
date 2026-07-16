# backend/routes/auth.py
from fastapi import APIRouter, Form, HTTPException, Header, Query, Cookie, Response, Request
from typing import Optional
import bcrypt
import os
import datetime
import jwt
import re
from db import get_conn, get_cursor, execute_sql
from rate_limit import auth_limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])

is_prod = os.getenv("ENV", "development").lower() == "production" or os.getenv("SECURE_COOKIES", "false").lower() == "true"

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    if is_prod:
        raise RuntimeError("CRITICAL SECURITY ERROR: The JWT_SECRET environment variable must be set in production mode!")
    else:
        import secrets
        JWT_SECRET = secrets.token_hex(32)
        print("[WARN] JWT_SECRET not found in environment. Generated dynamic session key for development.")

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
    """Verify password strength: 8-128 chars, uppercase, lowercase, number, special char."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must be at most 128 characters long."
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
    """Create a signed JWT token that expires in 15 minutes."""
    payload = {
        "sub": username,
        "type": "access",
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def _create_refresh_token(username: str) -> str:
    """Create a signed JWT refresh token that expires in 7 days and store it in DB."""
    expires_in = datetime.timedelta(days=7)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + expires_in
    payload = {
        "sub": username,
        "type": "refresh",
        "exp": expires_at
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    try:
        with get_conn() as conn:
            cur = get_cursor(conn)
            # Delete old tokens to keep the db tidy
            execute_sql(cur, "DELETE FROM refresh_tokens WHERE username = ?", (username,))
            # Insert the new one
            execute_sql(
                cur,
                "INSERT INTO refresh_tokens (username, token, expires_at) VALUES (?, ?, ?)",
                (username, token, expires_at.replace(tzinfo=None))
            )
            conn.commit()
    except Exception as e:
        print(f"[DB] Error saving refresh token: {e}")
    return token


def _decode_access_token(token: str) -> str:
    """Decode and verify access token. Returns verified username."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
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
    request: Request,
    response: Response,
    username: str           = Form(...),
    password: str           = Form(...),
    name:     Optional[str] = Form(None),
    email:    Optional[str] = Form(None),
    mobile:   Optional[str] = Form(None),
):
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check_rate_limit(client_ip)
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

    try:
        with get_conn() as conn:
            cur  = get_cursor(conn)
            execute_sql(
                cur,
                "INSERT INTO users (username, password, name, email, mobile) VALUES (?, ?, ?, ?, ?)",
                (username.strip(), hashed, name, email, mobile)
            )
            conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Username already exists")

    username_clean = username.strip()
    access_token = _create_access_token(username_clean)
    ref_token = _create_refresh_token(username_clean)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=900,  # 15 minutes
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=ref_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=604800,  # 7 days
        path="/"
    )
    return {
        "status": "success",
        "message": f"User '{username_clean}' registered successfully",
        "username": username_clean,
        "token": access_token,
        "refresh_token": ref_token
    }


@router.post("/login")
def login(
    request: Request,
    response: Response,
    username: str = Form(...),
    password: str = Form(...)
):
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check_rate_limit(client_ip)
    """
    Authenticate user. Supports both bcrypt-hashed passwords and legacy
    plain-text passwords (auto-migrates to bcrypt on first successful login).
    Returns username and a signed JWT access token in response + cookie.
    """
    authenticated = False
    with get_conn() as conn:
        cur  = get_cursor(conn)
        execute_sql(cur, "SELECT password FROM users WHERE username = ?", (username,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        stored = row["password"]

        # ── Legacy migration: plain-text password stored (old account) ──────────
        if _is_plain_text(stored):
            if stored == password:
                # Silently upgrade to bcrypt hash
                new_hash = _hash_password(password)
                execute_sql(cur, "UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
                conn.commit()
                authenticated = True
        else:
            # ── Normal bcrypt verification ───────────────────────────────────────────
            if _verify_password(password, stored):
                authenticated = True

    if not authenticated:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = _create_access_token(username)
    ref_token = _create_refresh_token(username)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=900,  # 15 minutes
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=ref_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=604800,  # 7 days
        path="/"
    )
    return {
        "status": "success",
        "message": "Login successful",
        "username": username,
        "token": access_token,
        "refresh_token": ref_token
    }


@router.post("/logout")
def logout(
    response: Response,
    access_token: Optional[str] = Cookie(None),
    refresh_token: Optional[str] = Cookie(None)
):
    try:
        token_to_use = access_token or refresh_token
        if token_to_use:
            payload = jwt.decode(token_to_use, JWT_SECRET, options={"verify_signature": False})
            username = payload.get("sub")
            if username:
                with get_conn() as conn:
                    cur = get_cursor(conn)
                    execute_sql(cur, "DELETE FROM refresh_tokens WHERE username = ?", (username,))
                    conn.commit()
    except Exception:
        pass

    response.delete_cookie(
        "access_token",
        path="/",
        secure=is_prod,
        samesite="none" if is_prod else "lax"
    )
    response.delete_cookie(
        "refresh_token",
        path="/",
        secure=is_prod,
        samesite="none" if is_prod else "lax"
    )
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

    with get_conn() as conn:
        cur  = get_cursor(conn)
        execute_sql(cur, "SELECT username FROM users WHERE username = ?", (username,))
        user = cur.fetchone()

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
    
    with get_conn() as conn:
        cur  = get_cursor(conn)
        execute_sql(cur, "SELECT id, username, name, email, mobile FROM users WHERE username = ?", (username,))
        user = cur.fetchone()

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
    
    with get_conn() as conn:
        cur  = get_cursor(conn)
        execute_sql(
            cur,
            "UPDATE users SET name = ?, email = ?, mobile = ? WHERE username = ?",
            (name, email, mobile, username)
        )
        conn.commit()
        rows = cur.rowcount

    if rows == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "success", "message": "Profile updated successfully"}


@router.put("/password")
def change_password(
    request: Request,
    old_password: str = Form(...),
    new_password: str = Form(...),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Change password for the authenticated user."""
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check_rate_limit(client_ip)
    username = _get_username_from_auth_header(authorization, access_token)
    
    is_strong, msg = _is_strong_password(new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=msg)

    with get_conn() as conn:
        cur  = get_cursor(conn)
        execute_sql(cur, "SELECT password FROM users WHERE username = ?", (username,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        stored = row["password"]

        # Support both legacy plain-text and bcrypt-hashed passwords
        if _is_plain_text(stored):
            correct = (stored == old_password)
        else:
            correct = _verify_password(old_password, stored)

        if not correct:
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Save new bcrypt hash
        new_hash = _hash_password(new_password)
        execute_sql(cur, "UPDATE users SET password = ? WHERE username = ?", (new_hash, username))
        conn.commit()

    return {"status": "success", "message": "Password changed successfully"}


@router.post("/refresh")
def refresh_session(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """
    Refresh access token using a valid HttpOnly refresh token.
    Implements Refresh Token Rotation for enhanced security.
    """
    token = refresh_token
    if not token and authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token signature")

    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, "SELECT token, expires_at FROM refresh_tokens WHERE username = ? AND token = ?", (username, token))
        row = cur.fetchone()

        if not row:
            # Token reuse detection
            execute_sql(cur, "DELETE FROM refresh_tokens WHERE username = ?", (username,))
            conn.commit()
            raise HTTPException(status_code=401, detail="Refresh token reuse or invalid session. Please log in again.")

        expires_at = row["expires_at"]
        if expires_at < datetime.datetime.now():
            execute_sql(cur, "DELETE FROM refresh_tokens WHERE username = ?", (username,))
            conn.commit()
            raise HTTPException(status_code=401, detail="Refresh token lease expired")

    new_access_token = _create_access_token(username)
    new_ref_token = _create_refresh_token(username)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=900,  # 15 minutes
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=new_ref_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=604800,  # 7 days
        path="/"
    )

    return {
        "status": "success",
        "message": "Token refreshed successfully",
        "token": new_access_token,
        "refresh_token": new_ref_token
    }
