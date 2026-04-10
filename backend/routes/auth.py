from fastapi import APIRouter, Form, HTTPException
from db import get_conn

router = APIRouter(prefix="/auth", tags=["Authentication"])

from typing import Optional

@router.post("/register")
def register(
    username: str = Form(...), 
    password: str = Form(...),
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    mobile: Optional[str] = Form(None)
):
    """
    Register a new user with extended details.
    """
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password, name, email, mobile) VALUES (?, ?, ?, ?, ?)", 
            (username, password, name, email, mobile)
        )
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="User already exists")
    conn.close()
    return {"status": "success", "message": f"User {username} registered"}

@router.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    """
    Authenticate user from SQLite DB.
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"status": "success", "message": "Login successful", "username": username}


@router.get("/verify")
def verify_session(username: str):
    """
    Verify that a username session is still valid (user exists in DB).
    Used by the frontend to restore a persisted login on page load.
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Session invalid")

    return {"status": "valid", "username": username}


@router.get("/profile")
def get_profile(username: str):
    """
    Fetch the full profile for a given username.
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, username, name, email, mobile FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"] or "",
        "email": user["email"] or "",
        "mobile": user["mobile"] or "",
    }


@router.put("/profile")
def update_profile(
    username: str = Form(...),
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    mobile: Optional[str] = Form(None),
):
    """
    Update user profile fields (name, email, mobile).
    """
    conn = get_conn()
    cur = conn.cursor()
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
