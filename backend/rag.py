# backend/rag.py
import os
import csv
import json
import traceback
from typing import List, Dict, Any, Optional
import chromadb
from google import genai

# Database path (relative to backend folder)
CHROMA_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "chromadb")
COLLECTION_NAME = "knowledge_worker_rag"

_collection: Any = None

def get_chroma_collection() -> Any:
    """
    Get or initialize the ChromaDB persistent collection.
    """
    global _collection
    if _collection is not None:
        return _collection

    os.makedirs(CHROMA_DB_PATH, exist_ok=True)
    try:
        # Initialize PersistentClient
        client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        # Get or create the collection
        _collection = client.get_or_create_collection(name=COLLECTION_NAME)
        return _collection
    except Exception as e:
        print(f"Error initializing ChromaDB: {e}")
        traceback.print_exc()
        return None

def init_rag():
    """
    Called at startup to initialize ChromaDB.
    """
    col = get_chroma_collection()
    if col is not None:
        print(f"RAG Engine Initialized. ChromaDB collection '{COLLECTION_NAME}' loaded. Total items: {col.count()}")
    else:
        print("RAG Engine Initialization Failed.")

def get_gemini_client():
    """
    Initialize Gemini API client.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("your_") or len(api_key.strip()) < 10:
        return None
    try:
        return genai.Client(api_key=api_key.strip())
    except Exception as e:
        print(f"Error initializing Gemini client for RAG: {e}")
        return None

def get_gemini_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate text-embedding-004 embeddings for a batch of texts using Gemini API.
    Provides automatic fallback to individual queries if batch results are incomplete or fail.
    """
    if not texts:
        return []
    
    client = get_gemini_client()
    if not client:
        raise ValueError("Gemini API key is not configured or is invalid. Cannot generate embeddings.")

    all_embeddings = []
    
    # 1. Try batch embedding first (efficient, 1 API call)
    try:
        texts_any: Any = texts
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=texts_any
        )
        response_any: Any = response
        if hasattr(response_any, 'embeddings') and response_any.embeddings:
            for emb in response_any.embeddings:
                all_embeddings.append(emb.values)
    except Exception as e:
        print(f"Batch embedding failed: {e}. Falling back to individual embedding...")
 
    # 2. If batching returned incorrect length or failed, fallback to individual text queries
    if len(all_embeddings) != len(texts):
        all_embeddings = []
        print(f"Embedding count mismatch (got {len(all_embeddings)}, expected {len(texts)}). Embedding items individually...")
        for text in texts:
            try:
                response = client.models.embed_content(
                    model="gemini-embedding-2",
                    contents=text
                )
                response_any: Any = response
                if hasattr(response_any, 'embedding') and response_any.embedding is not None:
                    emb: Any = response_any.embedding
                    if hasattr(emb, 'values') and emb.values is not None:
                        all_embeddings.append(list(emb.values))
                elif hasattr(response_any, 'embeddings') and response_any.embeddings:
                    all_embeddings.append(list(response_any.embeddings[0].values))
                else:
                    raise ValueError("Could not extract embedding values.")
            except Exception as e:
                print(f"Individual embedding failed for text '{text[:30]}...': {e}")
                raise e
            
    return all_embeddings

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks of a target character length.
    """
    if not text or not text.strip():
        return []
    
    chunks = []
    text = text.strip()
    start = 0
    while start < len(text):
        end = start + chunk_size
        # Try to slice at word boundary if possible within the overlap budget
        if end < len(text):
            # Scan backwards up to 'overlap' characters for a whitespace or newline
            boundary = -1
            for offset in range(overlap):
                pos = end - offset
                if pos < len(text) and text[pos].isspace():
                    boundary = pos
                    break
            if boundary != -1:
                end = boundary + 1 # Include the space
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            
        start = end - overlap
        if start >= len(text) or chunk_size <= overlap:
            break
            
    return chunks

def extract_file_content(filepath: str, filename: str) -> str:
    """
    Parse CSV, JSON, PDF, TXT, or MD files and return their text content.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found at path: {filepath}")

    ext = filename.split(".")[-1].lower()

    if ext == "csv":
        rows_text = []
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            rows = list(reader)
            
        if not rows:
            return ""
            
        # Treat first row as header
        headers = [h.strip() for h in rows[0]]
        for i, row in enumerate(rows[1:]):
            row_vals = []
            for j, val in enumerate(row):
                header = headers[j] if j < len(headers) else f"Column {j+1}"
                row_vals.append(f"{header}={val.strip()}")
            rows_text.append(f"Row {i+1}: {', '.join(row_vals)}")
        return "\n".join(rows_text)

    elif ext == "json":
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
        if isinstance(data, list):
            objects_text = []
            for i, obj in enumerate(data):
                objects_text.append(f"Item {i+1}: {json.dumps(obj)}")
            return "\n".join(objects_text)
        return json.dumps(data, indent=2)

    elif ext == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(filepath)
        text_list = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                text_list.append(f"[Page {i+1}]\n{page_text.strip()}")
        return "\n\n".join(text_list)

    else:
        # Fallback to plain text for txt, md, etc.
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

def index_file(filepath: str, filename: str) -> Dict[str, Any]:
    """
    Extract file content, generate chunk embeddings, and index into ChromaDB.
    """
    collection = get_chroma_collection()
    if collection is None:
        raise RuntimeError("ChromaDB collection is not initialized.")

    # 1. Clean up any existing index for this filename
    delete_file_index(filename)

    # 2. Extract content
    print(f"Indexing file: {filename}...")
    content = extract_file_content(filepath, filename)
    if not content.strip():
        return {"filename": filename, "status": "empty", "chunks": 0}

    # 3. Create chunks
    chunks = chunk_text(content, chunk_size=500, overlap=50)
    if not chunks:
        return {"filename": filename, "status": "empty", "chunks": 0}

    print(f"Created {len(chunks)} chunks for {filename}. Generating embeddings...")

    # 4. Generate embeddings
    embeddings = get_gemini_embeddings_batch(chunks)

    # 5. Insert into vector store
    ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"filename": filename, "chunk_index": i, "total_chunks": len(chunks)} for i in range(len(chunks))]

    embeddings_any: Any = embeddings
    metadatas_any: Any = metadatas
    collection.add(
        embeddings=embeddings_any,
        documents=chunks,
        metadatas=metadatas_any,
        ids=ids
    )

    print(f"Successfully indexed '{filename}' with {len(chunks)} chunks.")
    return {"filename": filename, "status": "success", "chunks": len(chunks)}

def delete_file_index(filename: str):
    """
    Remove all document chunks for a specific file from ChromaDB.
    """
    collection = get_chroma_collection()
    if collection is None:
        return
    
    try:
        # ChromaDB allows deleting by metadata matches
        collection.delete(where={"filename": filename})
        print(f"Deleted index for file: {filename}")
    except Exception as e:
        print(f"Error deleting index for file {filename}: {e}")

def get_indexed_files() -> List[Dict[str, Any]]:
    """
    Get a list of all indexed files and their chunk counts.
    """
    collection = get_chroma_collection()
    if collection is None:
        return []

    try:
        # Fetch metadata for all documents in the collection
        results = collection.get(include=["metadatas"])
        if results is None:
            return []
        metadatas = results.get("metadatas") or []
        
        # Group and count
        file_counts = {}
        for meta_raw in metadatas:
            meta: Any = meta_raw
            if meta and isinstance(meta, dict):
                filename = meta.get("filename")
                if filename:
                    file_counts[filename] = file_counts.get(filename, 0) + 1
        
        return [{"filename": fname, "chunks": count} for fname, count in file_counts.items()]
    except Exception as e:
        print(f"Error listing indexed files: {e}")
        return []

def search_knowledge(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Embed user query and query ChromaDB for top_k most similar document chunks.
    """
    collection = get_chroma_collection()
    if collection is None:
        print("Warning: ChromaDB collection not initialized. Returning empty search results.")
        return []

    # Get query embedding
    try:
        query_embedding = get_gemini_embeddings_batch([query])[0]
    except Exception as e:
        print(f"Error embedding query '{query}': {e}")
        return []

    try:
        # Query database
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        if results is None:
            return []

        formatted_results = []
        documents = results.get("documents")
        metadatas = results.get("metadatas")
        distances = results.get("distances")

        docs_list = documents[0] if documents and len(documents) > 0 else []
        metas_list = metadatas[0] if metadatas and len(metadatas) > 0 else []
        dists_list = distances[0] if distances and len(distances) > 0 else []

        for doc, meta_raw, dist in zip(docs_list, metas_list, dists_list):
            meta: Any = meta_raw
            if doc is not None and meta is not None and dist is not None:
                # Calculate a similarity score. For L2 distance (Chroma default), lower distance is more similar.
                # Convert to a simple percentage-like confidence score.
                similarity = round(max(0.0, 1.0 - (float(dist) / 2.0)) * 100, 2)
                formatted_results.append({
                    "content": str(doc),
                    "filename": meta.get("filename", "unknown") if hasattr(meta, "get") else "unknown",
                    "chunk_index": meta.get("chunk_index", 0) if hasattr(meta, "get") else 0,
                    "total_chunks": meta.get("total_chunks", 0) if hasattr(meta, "get") else 0,
                    "similarity_score": similarity
                })

        return formatted_results
    except Exception as e:
        print(f"Error searching ChromaDB: {e}")
        return []
