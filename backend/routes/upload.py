import csv, json, io, os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from db import get_conn, insert_history

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        size = os.path.getsize(file_path)
        conn = get_conn()
        conn.execute(
            "INSERT INTO uploads (filename, filepath, size) VALUES (?, ?, ?)",
            (file.filename, file_path, size),
        )
        conn.commit()
        conn.close()

        # ✅ Log to history
        insert_history("file_upload", f"filename={file.filename}, size={size} bytes")

        if file.filename.lower().endswith(".csv"):
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            data_preview = [row for _, row in zip(range(5), reader)]
            return {"message": f"CSV '{file.filename}' uploaded", "file_path": file_path, "data_preview": data_preview}
        elif file.filename.lower().endswith(".json"):
            data = json.loads(content.decode("utf-8"))
            preview = data[:5] if isinstance(data, list) else data
            return {"message": f"JSON '{file.filename}' uploaded", "file_path": file_path, "data_preview": preview}
        else:
            return JSONResponse(content={"error": "Unsupported file type"}, status_code=400)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.get("/list")
def list_uploads():
    conn = get_conn()
    rows = conn.execute("SELECT id, filename, filepath, size, uploaded_at FROM uploads ORDER BY uploaded_at DESC").fetchall()
    uploads = [dict(r) for r in rows]
    conn.close()
    return {"uploads": uploads}

@router.get("/download/{filename}")
def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # ✅ Log to history
    insert_history("file_download", f"filename={filename}")

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=filename,
    )
