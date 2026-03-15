from fastapi import APIRouter, Query, Body
from db import get_conn, insert_history
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

@router.get("/")
def get_history(q: Optional[str] = Query(None), type: Optional[str] = Query(None), limit: int = Query(100)):
    conn = get_conn()
    cur = conn.cursor()
    sql = "SELECT id, event_type, payload, created_at FROM history"
    params = []
    if type and q:
        sql += " WHERE event_type = ? AND payload LIKE ?"
        params = [type, f"%{q}%"]
    elif type:
        sql += " WHERE event_type = ?"
        params = [type]
    elif q:
        sql += " WHERE payload LIKE ?"
        params = [f"%{q}%"]
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = cur.execute(sql, params).fetchall()
    history = [dict(r) for r in rows]
    conn.close()
    # Try parsing payload as JSON
    for h in history:
        try:
            h['payload'] = json.loads(h['payload'])
        except:
            pass
    return {"history": history}
