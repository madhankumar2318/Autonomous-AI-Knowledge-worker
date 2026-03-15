from fastapi import APIRouter, Form, HTTPException
from db import get_conn

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(username: str = Form(...), password: str = Form(...)):
    """
    Register a new user.
    """
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
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
