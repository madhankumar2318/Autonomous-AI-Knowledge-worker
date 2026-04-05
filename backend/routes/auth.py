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
