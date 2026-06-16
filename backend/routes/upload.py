import csv, json, io, os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from db import get_conn, insert_history

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# List of allowed file extensions
ALLOWED_EXTENSIONS = {".csv", ".json", ".pdf", ".txt", ".md"}

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        filename = file.filename
        _, ext = os.path.splitext(filename.lower())
        
        if ext not in ALLOWED_EXTENSIONS:
            return JSONResponse(
                content={"error": f"Unsupported file type '{ext}'. Supported: CSV, JSON, PDF, TXT, MD."},
                status_code=400
            )

        file_path = os.path.join(UPLOAD_DIR, filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        size = os.path.getsize(file_path)
        
        # Save to database
        conn = get_conn()
        conn.execute(
            "INSERT INTO uploads (filename, filepath, size) VALUES (?, ?, ?)",
            (filename, file_path, size),
        )
        conn.commit()
        conn.close()

        # Log to history
        insert_history("system", "file_upload", f"filename={filename}, size={size} bytes")

        # Dynamic RAG Indexing
        rag_status = "pending"
        chunks_count = 0
        error_msg = None
        try:
            from rag import index_file
            res = index_file(file_path, filename)
            rag_status = res.get("status", "success")
            chunks_count = res.get("chunks", 0)
        except Exception as e:
            rag_status = "failed"
            error_msg = str(e)
            print(f"RAG Indexing failed for {filename}: {e}")

        # Get preview based on file type
        data_preview = None
        if ext == ".csv":
            try:
                text = content.decode("utf-8", errors="ignore")
                reader = csv.DictReader(io.StringIO(text))
                data_preview = [row for _, row in zip(range(5), reader)]
            except:
                pass
        elif ext == ".json":
            try:
                data = json.loads(content.decode("utf-8", errors="ignore"))
                data_preview = data[:5] if isinstance(data, list) else data
            except:
                pass
        elif ext in {".txt", ".md"}:
            try:
                text_preview = content.decode("utf-8", errors="ignore")[:300]
                data_preview = text_preview + ("..." if len(content) > 300 else "")
            except:
                pass
        elif ext == ".pdf":
            data_preview = "PDF Document (Preview not available directly)"

        return {
            "message": f"File '{filename}' uploaded successfully",
            "file_path": file_path,
            "data_preview": data_preview,
            "rag_status": rag_status,
            "chunks": chunks_count,
            "error": error_msg
        }
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.get("/list")
def list_uploads():
    conn = get_conn()
    rows = conn.execute("SELECT id, filename, filepath, size, uploaded_at FROM uploads ORDER BY uploaded_at DESC").fetchall()
    uploads = [dict(r) for r in rows]
    conn.close()
    
    # Merge with ChromaDB indexed files
    try:
        from rag import get_indexed_files
        indexed = {item["filename"]: item["chunks"] for item in get_indexed_files()}
    except Exception as e:
        print(f"Error fetching indexed files for list: {e}")
        indexed = {}
        
    for item in uploads:
        filename = item["filename"]
        item["rag_indexed"] = filename in indexed
        item["chunks"] = indexed.get(filename, 0)
        
    return {"uploads": uploads}

@router.delete("/{filename}")
def delete_file(filename: str):
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 1. Delete physical file
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # 2. Delete database entry
        conn = get_conn()
        conn.execute("DELETE FROM uploads WHERE filename = ?", (filename,))
        conn.commit()
        conn.close()
        
        # 3. Clean up from ChromaDB
        try:
            from rag import delete_file_index
            delete_file_index(filename)
        except Exception as e:
            print(f"Failed to delete RAG index for {filename}: {e}")
            
        # 4. Log to history
        insert_history("system", "file_delete", f"filename={filename}")
        
        return {"message": f"File '{filename}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    insert_history("system", "file_download", f"filename={filename}")

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=filename,
    )
