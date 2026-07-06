from fastapi import APIRouter, Query, Body, Header, Cookie, HTTPException
from db import get_conn, get_cursor, execute_sql, insert_history
import json
from typing import Optional
from routes.auth import _get_username_from_auth_header

router = APIRouter(prefix="/history", tags=["History"])

@router.post("/log")
def log_event(
    event: dict = Body(...),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """
    Log an event to the audit trail.
    Example body:
    {
      "event_type": "news_search",
      "payload": {"query": "AI"}
    }
    """
    event_type = event.get("event_type")
    payload = event.get("payload", {})
    if not event_type:
        raise HTTPException(status_code=400, detail="event_type required")

    # Retrieve username context (default to guest if not authenticated)
    try:
        username = _get_username_from_auth_header(authorization, access_token)
    except Exception:
        username = "guest"

    insert_history(username, event_type, json.dumps(payload))
    return {"status": "ok"}

@router.get("/list")
def get_history(
    q: Optional[str] = Query(None),
    limit: int = Query(100),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """
    Fetch history logs. Only returns logs belonging to the authenticated user.
    """
    # Enforce active session verification
    username = _get_username_from_auth_header(authorization, access_token)

    sql = "SELECT id, username, action, details, timestamp AS created_at FROM history WHERE username = ?"
    params = [username]
    
    if q:
        sql += " AND (action LIKE ? OR details LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
        
    sql += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, sql, params)
        rows = cur.fetchall()
        history = [dict(r) for r in rows]
    
    return {"history": history}
