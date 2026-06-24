# backend/routes/upload.py
import csv, json, io, os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from db import get_conn, get_cursor, execute_sql, insert_history
import boto3
from botocore.client import Config

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# List of allowed file extensions
ALLOWED_EXTENSIONS = {".csv", ".json", ".pdf", ".txt", ".md"}

# S3 Cloud Storage Configurations
S3_BUCKET = os.getenv("S3_BUCKET")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_REGION_NAME = os.getenv("S3_REGION_NAME", "us-east-1")

IS_S3 = S3_BUCKET is not None and S3_ACCESS_KEY is not None and S3_SECRET_KEY is not None
_s3_client = None

def get_s3_client():
    global _s3_client
    if not IS_S3:
        return None
    if _s3_client is None:
        kwargs = {
            "aws_access_key_id": S3_ACCESS_KEY,
            "aws_secret_access_key": S3_SECRET_KEY,
            "region_name": S3_REGION_NAME,
        }
        if S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = S3_ENDPOINT_URL
            kwargs["config"] = Config(signature_version="s3v4")
        _s3_client = boto3.client("s3", **kwargs)
    return _s3_client

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

        size = len(content)

        # Upload to S3 if configured
        if IS_S3:
            s3_client = get_s3_client()
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=filename,
                Body=content
            )

        # Save to database
        db_filepath = f"s3://{S3_BUCKET}/{filename}" if IS_S3 else file_path
        conn = get_conn()
        cur = get_cursor(conn)
        execute_sql(
            cur,
            "INSERT INTO uploads (filename, filepath, size) VALUES (?, ?, ?)",
            (filename, db_filepath, size),
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
            "file_path": db_filepath,
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
    cur = get_cursor(conn)
    execute_sql(cur, "SELECT id, filename, filepath, size, uploaded_at FROM uploads ORDER BY uploaded_at DESC")
    rows = cur.fetchall()
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
        
        # 1. Delete physical file locally if it exists
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # 2. Delete from S3 if configured
        if IS_S3:
            s3_client = get_s3_client()
            try:
                s3_client.delete_object(Bucket=S3_BUCKET, Key=filename)
            except Exception as e:
                print(f"Failed to delete {filename} from S3: {e}")

        # 3. Delete database entry
        conn = get_conn()
        cur = get_cursor(conn)
        execute_sql(cur, "DELETE FROM uploads WHERE filename = ?", (filename,))
        conn.commit()
        conn.close()
        
        # 4. Clean up from ChromaDB
        try:
            from rag import delete_file_index
            delete_file_index(filename)
        except Exception as e:
            print(f"Failed to delete RAG index for {filename}: {e}")
            
        # 5. Log to history
        insert_history("system", "file_delete", f"filename={filename}")
        
        return {"message": f"File '{filename}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Log to history
    insert_history("system", "file_download", f"filename={filename}")

    # If S3 is active, try to stream from S3
    if IS_S3:
        try:
            s3_client = get_s3_client()
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=filename)
            return StreamingResponse(
                response['Body'].iter_chunks(),
                media_type="application/octet-stream",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        except Exception as e:
            print(f"S3 download failed/missing for {filename}: {e}. Falling back to local disk.")
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="File not found in S3 or local storage")

    # Local fallback
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=filename,
    )
