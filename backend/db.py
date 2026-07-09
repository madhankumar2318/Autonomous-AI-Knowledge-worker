# backend/db.py
import os
import psycopg2
import psycopg2.extras
import psycopg2.pool
import threading

# Check if PostgreSQL connection URL is provided in the environment
DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES = True

# ── Connection Pool ─────────────────────────────────────────────────────────────
# A thread-safe pool of reusable database connections.
# minconn=2  - always keep 2 warm connections alive
# maxconn=15 - allow up to 15 simultaneous connections before blocking
_pool = None
_pool_lock = threading.Lock()


def _build_db_url():
    """Normalize DATABASE_URL to postgresql:// scheme."""
    url = DATABASE_URL or ""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def _get_pool():
    """Lazily initialize and return the singleton connection pool."""
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        # Double-checked locking: another thread may have created it while we waited
        if _pool is not None:
            return _pool
        url = _build_db_url()
        _pool = psycopg2.pool.ThreadedConnectionPool(minconn=2, maxconn=15, dsn=url)
        print("[DB] Connection pool initialized (min=2, max=15)")
        return _pool


class PooledConnectionWrapper:
    """
    A transparent wrapper around a psycopg2 connection checked out from the pool.

    Intercepts .close() so returning a connection to the pool is handled
    automatically. All other attributes and methods are forwarded to the
    underlying real connection, so no downstream code changes are needed.
    """

    def __init__(self, conn, pool):
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "_pool", pool)
        object.__setattr__(self, "_returned", False)

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_conn"), name)

    def __setattr__(self, name, value):
        setattr(object.__getattribute__(self, "_conn"), name, value)

    def close(self):
        """Return connection to the pool instead of destroying it."""
        returned = object.__getattribute__(self, "_returned")
        if not returned:
            pool = object.__getattribute__(self, "_pool")
            conn = object.__getattribute__(self, "_conn")
            pool.putconn(conn)
            object.__setattr__(self, "_returned", True)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


# ── Connection Helpers ──────────────────────────────────────────────────────────

def get_conn():
    """
    Check out a connection from the thread-safe pool.

    The returned wrapper behaves exactly like a real psycopg2 connection.
    Calling .close() returns it to the pool for reuse, eliminating the
    TCP/SSL handshake overhead on every single query.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in the environment variables.")
    try:
        pool = _get_pool()
        raw_conn = pool.getconn()
        raw_conn.autocommit = False
        return PooledConnectionWrapper(raw_conn, pool)
    except psycopg2.pool.PoolError as e:
        raise RuntimeError(f"[DB] Connection pool exhausted: {e}") from e


def is_postgres_active():
    """Check if PostgreSQL connection pool is active and functional."""
    global _pool
    try:
        pool = _get_pool()
        conn = pool.getconn()
        pool.putconn(conn)
        return True
    except Exception:
        return False


def get_cursor(conn):
    """Returns a dictionary cursor for PostgreSQL."""
    return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)


def execute_sql(cur, sql, params=None):
    """Executes a SQL query, converting placeholders dynamically to PostgreSQL syntax."""
    if params is None:
        params = ()
    # Convert SQLite ? placeholders to PostgreSQL %s placeholders
    sql = sql.replace("?", "%s")
    # Replace SQLite local timestamp function with standard Postgres timestamp
    sql = sql.replace("datetime('now', 'localtime')", "CURRENT_TIMESTAMP")
    cur.execute(sql, params)
    return cur


# ── Database Init ───────────────────────────────────────────────────────────────

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
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_threads (
        id          TEXT PRIMARY KEY,
        username    VARCHAR(255) NOT NULL,
        title       VARCHAR(500) DEFAULT 'New Chat',
        model       VARCHAR(100),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id          SERIAL PRIMARY KEY,
        thread_id   TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        role        VARCHAR(10) NOT NULL,
        content     TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS chat_threads_user_idx ON chat_threads (username, updated_at DESC);")
    cur.execute("CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages (thread_id, created_at);")


    # ── Migrations ──────────────────────────────────────────────────────────────
    try:
        cur.execute("ALTER TABLE uploads ADD COLUMN IF NOT EXISTS user_id INTEGER")
    except Exception:
        pass

    try:
        cur.execute("ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS chunk_type TEXT DEFAULT 'text'")
    except Exception:
        pass

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
        cur.execute("ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;")
        cur.execute("ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;")
    except Exception as e:
        print(f"[WARN] Failed to enable RLS: {e}")

    conn.commit()
    conn.close()


# ── History Logger ──────────────────────────────────────────────────────────────

def insert_history(username, action, details=""):
    """Insert a record into the history table."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(
            cur,
            "INSERT INTO history (username, action, details, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (username, action, details)
        )
        conn.commit()


# ── Reports ────────────────────────────────────────────────────────────────────

def insert_report(news, stock, insights):
    """Insert generated report into reports table."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(
            cur,
            "INSERT INTO reports (news, stock, insights) VALUES (?, ?, ?)",
            (news, stock, insights)
        )
        conn.commit()


# ── Generic Query Helper ────────────────────────────────────────────────────────

def log_action(action):
    """Simple history log (without username)."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, "INSERT INTO history (action) VALUES (?)", (action,))
        conn.commit()


def get_user_id(username):
    """Retrieve database ID for a given username."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, "SELECT id FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
    if row:
        try:
            return row["id"]
        except Exception:
            return row[0]
    return None

