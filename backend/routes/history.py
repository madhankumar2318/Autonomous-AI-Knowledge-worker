from fastapi import APIRouter, Query, Header, Cookie, HTTPException
from pydantic import BaseModel, Field
from db import get_conn, get_cursor, execute_sql, insert_history
import json
from typing import Optional
from routes.auth import _get_username_from_auth_header

router = APIRouter(prefix="/history", tags=["History"])


class LogEventRequest(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_\-]+$", description="Event action identifier")
    payload: Optional[dict] = Field(default_factory=dict, description="Event metadata payload dictionary")


@router.post("/log")
def log_event(
    req: LogEventRequest,
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """
    Log an event to the audit trail.
    """
    # Retrieve username context (default to guest if not authenticated)
    try:
        username = _get_username_from_auth_header(authorization, access_token)
    except Exception:
        username = "guest"

    insert_history(username, req.event_type, json.dumps(req.payload or {}))
    return {"status": "ok"}

@router.get("/list")
def get_history(
    q: Optional[str] = Query(None, max_length=200, description="Optional search term to filter history"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
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
