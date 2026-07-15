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
