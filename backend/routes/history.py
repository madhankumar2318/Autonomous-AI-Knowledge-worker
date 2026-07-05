from fastapi import APIRouter, Query, Body
from db import get_conn, get_cursor, execute_sql, insert_history
import json
from typing import Optional

router = APIRouter(prefix="/history", tags=["History"])

@router.post("/log")
def log_event(event: dict = Body(...)):
    """
    Example body:
    {
      "event_type": "news_search",
      "payload": {"query": "AI"}
    }
    """
    event_type = event.get("event_type")
    payload = event.get("payload", {})
    if not event_type:
        return {"error": "event_type required"}
    insert_history(event_type, json.dumps(payload))
    return {"status": "ok"}

@router.get("/list")
def get_history(q: Optional[str] = Query(None), type: Optional[str] = Query(None), limit: int = Query(100)):
    sql = "SELECT id, username, action, details, timestamp AS created_at FROM history"
    params = []
    
    if type and q:
        sql += " WHERE username = ? AND (action LIKE ? OR details LIKE ?)"
        params = [type, f"%{q}%", f"%{q}%"]
    elif type:
        sql += " WHERE username = ?"
        params = [type]
    elif q:
        sql += " WHERE action LIKE ? OR details LIKE ?"
        params = [f"%{q}%", f"%{q}%"]
        
    sql += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, sql, params)
        rows = cur.fetchall()
        history = [dict(r) for r in rows]
    
    return {"history": history}
