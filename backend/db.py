# backend/db.py
import sqlite3
import os
import psycopg2
import psycopg2.extras

# Check if PostgreSQL connection URL is provided in the environment
DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"))

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# ------------------------- CONNECTION HELPERS -------------------------
def get_conn():
    """Open connection. Connects to PostgreSQL if DATABASE_URL is set, otherwise SQLite."""
    if IS_POSTGRES:
        # Handle Render postgres URL format if it contains "postgres://" instead of "postgresql://"
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def get_cursor(conn):
    """Returns a dictionary cursor for PostgreSQL or standard cursor for SQLite."""
    if IS_POSTGRES:
        return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    else:
        return conn.cursor()

def execute_sql(cur, sql: str, params=None):
    """Executes a SQL query, converting placeholders dynamically depending on database driver."""
    if params is None:
        params = ()
    
    if IS_POSTGRES:
        # Convert SQLite ? placeholders to PostgreSQL %s placeholders
        sql = sql.replace("?", "%s")
        # Replace SQLite local timestamp function with standard Postgres timestamp
        sql = sql.replace("datetime('now', 'localtime')", "CURRENT_TIMESTAMP")
    
    cur.execute(sql, params)
    return cur

# ------------------------- DATABASE INIT -------------------------
def init_db():
    """Initialize all DB tables using syntax corresponding to the database driver."""
    conn = get_conn()
    cur = get_cursor(conn)

    if IS_POSTGRES:
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
            embedding VECTOR(3072)
        )
        """)
        cur.execute("""
        CREATE INDEX IF NOT EXISTS document_embeddings_file_user_idx 
        ON document_embeddings (filename, username);
        """)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            email TEXT,
            mobile TEXT
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            news TEXT,
            stock TEXT,
            insights TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            filepath TEXT,
            size INTEGER,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            action TEXT,
            details TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

    # Run migration to add user_id column if not exists
    try:
        if IS_POSTGRES:
            cur.execute("ALTER TABLE uploads ADD COLUMN IF NOT EXISTS user_id INTEGER")
        else:
            cur.execute("ALTER TABLE uploads ADD COLUMN user_id INTEGER")
    except Exception:
        pass

    conn.commit()

    # Insert default admin user if not present
    execute_sql(cur, "SELECT COUNT(*) FROM users WHERE username='admin'")
    if cur.fetchone()[0] == 0:
        import bcrypt
        hashed = bcrypt.hashpw("1234".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        execute_sql(
            cur,
            "INSERT INTO users (username, password) VALUES (?, ?)",
            ("admin", hashed)
        )
        print("[OK] Default admin user created (username: admin, password: bcrypt-hashed)")

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
