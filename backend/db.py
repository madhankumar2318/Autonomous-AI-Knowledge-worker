# backend/db.py
import os
import psycopg2
import psycopg2.extras

# Check if PostgreSQL connection URL is provided in the environment
DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES = True

# ------------------------- CONNECTION HELPERS -------------------------
def get_conn():
    """Open connection to the Supabase PostgreSQL database."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in the environment variables.")
    
    # Handle Render/standard postgres URL format if it contains "postgres://" instead of "postgresql://"
    url = DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    conn = psycopg2.connect(url)
    return conn


def is_postgres_active() -> bool:
    """Check if PostgreSQL connection is active."""
    return True

def get_cursor(conn):
    """Returns a dictionary cursor for PostgreSQL."""
    return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

def execute_sql(cur, sql: str, params=None):
    """Executes a SQL query, converting placeholders dynamically to PostgreSQL syntax."""
    if params is None:
        params = ()
    
    # Convert SQLite ? placeholders to PostgreSQL %s placeholders
    sql = sql.replace("?", "%s")
    # Replace SQLite local timestamp function with standard Postgres timestamp
    sql = sql.replace("datetime('now', 'localtime')", "CURRENT_TIMESTAMP")
    
    cur.execute(sql, params)
    return cur

# ------------------------- DATABASE INIT -------------------------
def init_db():
    """Initialize all DB tables inside the Supabase PostgreSQL database."""
    conn = get_conn()
    cur = get_cursor(conn)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        email TEXT,
        mobile TEXT
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        news TEXT,
        stock TEXT,
        insights TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        filepath TEXT,
        size BIGINT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        username TEXT,
        action TEXT,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # pgvector extension and document embeddings setup
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS document_embeddings (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        total_chunks INTEGER,
        username TEXT,
        content TEXT,
        embedding VECTOR(3072),
        chunk_type TEXT DEFAULT 'text',
        page_num INTEGER DEFAULT 0
    )
    """)
    cur.execute("""
    CREATE INDEX IF NOT EXISTS document_embeddings_file_user_idx 
    ON document_embeddings (filename, username);
    """)

    # ── Migrations ────────────────────────────────────────────────────────────
    # Add user_id column to uploads table if not exists
    try:
        cur.execute("ALTER TABLE uploads ADD COLUMN IF NOT EXISTS user_id INTEGER")
    except Exception:
        pass

    # Add chunk_type column to document_embeddings (pgvector) for advanced chunking
    try:
        cur.execute("ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS chunk_type TEXT DEFAULT 'text'")
    except Exception:
        pass

    # Add page_num column to document_embeddings (pgvector) for PDF page tracking
    try:
        cur.execute("ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS page_num INTEGER DEFAULT 0")
    except Exception:
        pass

    # Enable Row-Level Security (RLS) on all tables for Supabase security compliance
    try:
        cur.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE reports ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE history ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;")
    except Exception as e:
        print(f"[WARN] Failed to enable RLS: {e}")

    conn.commit()
    conn.close()

# ------------------------- HISTORY LOGGER -------------------------
def insert_history(username: str, action: str, details: str = ""):
    """Insert a record into the history table."""
    conn = get_conn()
    cur = get_cursor(conn)
    execute_sql(
        cur,
        "INSERT INTO history (username, action, details, timestamp) VALUES (?, ?, ?, datetime('now', 'localtime'))",
        (username, action, details)
    )
    conn.commit()
    conn.close()

# ------------------------- REPORTS -------------------------
def insert_report(news: str, stock: str, insights: str):
    """Insert generated report into reports table."""
    conn = get_conn()
    cur = get_cursor(conn)
    execute_sql(
        cur,
        "INSERT INTO reports (news, stock, insights) VALUES (?, ?, ?)",
        (news, stock, insights)
    )
    conn.commit()
    conn.close()

# ------------------------- GENERIC QUERY HELPER -------------------------
def log_action(action: str):
    """Simple history log (without username)."""
    conn = get_conn()
    cur = get_cursor(conn)
    execute_sql(cur, "INSERT INTO history (action) VALUES (?)", (action,))
    conn.commit()
    conn.close()

def get_user_id(username: str):
    """Retrieve database ID for a given username."""
    conn = get_conn()
    cur = get_cursor(conn)
    execute_sql(cur, "SELECT id FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()
    if row:
        try:
            return row["id"]
        except Exception:
            return row[0]
    return None
