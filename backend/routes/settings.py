from fastapi import APIRouter, HTTPException, Depends, Cookie, Query, Header
from pydantic import BaseModel
from typing import Optional
import os
from db import get_user_id, get_user_settings, save_user_settings
from routes.auth import _decode_access_token

router = APIRouter(prefix="/settings", tags=["settings"])

class UserSettingsSchema(BaseModel):
    default_model: Optional[str] = 'llama-70b'
    temperature: Optional[float] = 0.1
    system_prompt: Optional[str] = ''
    chunk_size: Optional[int] = 800
    chunk_overlap: Optional[int] = 100

def get_current_user_id(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
) -> int:
    token_to_decode = access_token or token
    if not token_to_decode and authorization:
        parts = authorization.split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_to_decode = parts[1]

    if not token_to_decode:
        raise HTTPException(status_code=401, detail="Authentication token required")

    try:
        username = _decode_access_token(token_to_decode)
        user_id = get_user_id(username)
        if not user_id:
            raise HTTPException(status_code=401, detail="User session invalid")
        return user_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

@router.get("/")
def read_settings(user_id: int = Depends(get_current_user_id)):
    try:
        return get_user_settings(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/")
def update_settings(req: UserSettingsSchema, user_id: int = Depends(get_current_user_id)):
    try:
        save_user_settings(user_id, req.dict())
        return {"status": "success", "message": "Settings saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_analytics(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """
    Fetch user token usage, estimated costs, and model latency data.
    """
    from routes.auth import _get_username_from_auth_header
    try:
        username = _get_username_from_auth_header(authorization, access_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")
        
    if username == "guest":
        return {
            "daily_usage": [],
            "model_distribution": [],
            "total_cost": 0.0,
            "average_latency": {}
        }
        
    from db import get_conn, get_cursor, execute_sql
    try:
        with get_conn() as conn:
            cur = get_cursor(conn)
            db_type = "postgres" if hasattr(conn, "get_dsn_parameters") else "sqlite"
            
            if db_type == "postgres":
                date_func = "TO_CHAR(timestamp, 'YYYY-MM-DD')"
            else:
                date_func = "strftime('%Y-%m-%d', timestamp)"
                
            query_daily = f"""
                SELECT 
                    {date_func} as day,
                    model,
                    SUM(input_tokens) as total_in,
                    SUM(output_tokens) as total_out,
                    SUM(estimated_cost_usd) as total_cost
                FROM token_usage
                WHERE username = %s AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '14 days'
                GROUP BY day, model
                ORDER BY day ASC
            """ if db_type == "postgres" else f"""
                SELECT 
                    {date_func} as day,
                    model,
                    SUM(input_tokens) as total_in,
                    SUM(output_tokens) as total_out,
                    SUM(estimated_cost_usd) as total_cost
                FROM token_usage
                WHERE username = ? AND timestamp >= datetime('now', '-14 days')
                GROUP BY day, model
                ORDER BY day ASC
            """
            
            execute_sql(cur, query_daily, (username,))
            daily_rows = cur.fetchall()
            
            query_models = """
                SELECT 
                    model,
                    SUM(input_tokens + output_tokens) as total_tokens,
                    SUM(estimated_cost_usd) as total_cost,
                    AVG(latency_ms) as avg_latency
                FROM token_usage
                WHERE username = %s
                GROUP BY model
            """ if db_type == "postgres" else """
                SELECT 
                    model,
                    SUM(input_tokens + output_tokens) as total_tokens,
                    SUM(estimated_cost_usd) as total_cost,
                    AVG(latency_ms) as avg_latency
                FROM token_usage
                WHERE username = ?
                GROUP BY model
            """
            
            execute_sql(cur, query_models, (username,))
            model_rows = cur.fetchall()
            
            daily_usage = []
            for r in daily_rows:
                if isinstance(r, dict):
                    row_dict = r
                else:
                    row_dict = {
                        "day": r[0],
                        "model": r[1],
                        "total_in": r[2] or 0,
                        "total_out": r[3] or 0,
                        "total_cost": float(r[4] or 0.0)
                    }
                daily_usage.append(row_dict)
                
            model_distribution = []
            total_cost = 0.0
            average_latency = {}
            
            for r in model_rows:
                if isinstance(r, dict):
                    model_name = r["model"]
                    tokens = r["total_tokens"] or 0
                    cost = float(r["total_cost"] or 0.0)
                    latency = float(r["avg_latency"] or 0.0)
                else:
                    model_name = r[0]
                    tokens = r[1] or 0
                    cost = float(r[2] or 0.0)
                    latency = float(r[3] or 0.0)
                    
                total_cost += cost
                model_distribution.append({
                    "model": model_name,
                    "tokens": tokens,
                    "cost": cost
                })
                average_latency[model_name] = round(latency, 2)
                
            return {
                "daily_usage": daily_usage,
                "model_distribution": model_distribution,
                "total_cost": round(total_cost, 4),
                "average_latency": average_latency
            }
            
    except Exception as e:
        print(f"[Analytics] Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
