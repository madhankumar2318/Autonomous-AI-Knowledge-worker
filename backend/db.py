# backend/db.py
import os
import time
import threading
import psycopg2
import psycopg2.extras
import psycopg2.pool
import psycopg2.extensions

# Check if PostgreSQL connection URL is provided in the environment
DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES = True

# ── Connection Pool ─────────────────────────────────────────────────────────────
# A thread-safe pool of reusable database connections.
# minconn=2  - always keep 2 warm connections alive
# maxconn=15 - allow up to 15 simultaneous connections before blocking
_pool = None
_pool_lock = threading.Lock()
_consecutive_pool_failures = 0


def _build_db_url():
    """Normalize DATABASE_URL to postgresql:// scheme and append keepalive options."""
    url = os.getenv("DATABASE_URL") or DATABASE_URL or ""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        keepalive_opts = "keepalives=1&keepalives_idle=30&keepalives_interval=10&keepalives_count=5"
        if "?" in url:
            if "keepalives" not in url:
                url += f"&{keepalive_opts}"
        else:
            url += f"?{keepalive_opts}"
    return url


def close_pool():
    """Safely close and drain all connections in the pool."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            try:
                _pool.closeall()
                print("[DB] Connection pool closed and drained successfully.")
            except Exception as e:
                print(f"[DB] Warning during pool close: {e}")
            finally:
                _pool = None


def _get_pool(force_recreate: bool = False):
    """Lazily initialize and return the singleton connection pool.
    
    If force_recreate is True, drains and discards any existing broken pool
    and initializes a brand new pool.
    """
    global _pool
    if not force_recreate and _pool is not None:
        return _pool
    with _pool_lock:
        if not force_recreate and _pool is not None:
            return _pool
        if _pool is not None:
            try:
                _pool.closeall()
            except Exception:
                pass
            _pool = None

        url = _build_db_url()
        if not url:
            raise ValueError("DATABASE_URL is not configured in the environment.")

        _pool = psycopg2.pool.ThreadedConnectionPool(minconn=2, maxconn=15, dsn=url)
        print("[DB] Connection pool initialized (min=2, max=15) with TCP keepalive.")
        return _pool


class PooledConnectionWrapper:
    """
    A transparent, robust wrapper around a psycopg2 connection checked out from the pool.

    Intercepts .close() to:
      1. Roll back any uncommitted transactions or clear aborted states so dirty
         state doesn't bleed into subsequent requests.
      2. Detect closed / broken socket connections and discard them from the pool
         with pool.putconn(conn, close=True).
      3. Return healthy idle connections to the pool with pool.putconn(conn).
      4. Forward all other attributes and methods to the underlying connection.
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
        """Return connection to the pool or discard if broken/dirty."""
        returned = object.__getattribute__(self, "_returned")
        if not returned:
            pool = object.__getattribute__(self, "_pool")
            conn = object.__getattribute__(self, "_conn")
            try:
                # 1. Check if the connection has been physically closed
                if getattr(conn, "closed", 0) != 0:
                    pool.putconn(conn, close=True)
                else:
                    # 2. Check transaction status: if in an active/error transaction, rollback cleanly
                    try:
                        status = conn.get_transaction_status()
                        if status in (psycopg2.extensions.TRANSACTION_STATUS_ACTIVE,
                                      psycopg2.extensions.TRANSACTION_STATUS_INTRANS,
                                      psycopg2.extensions.TRANSACTION_STATUS_INERROR):
                            conn.rollback()
                    except Exception:
                        pool.putconn(conn, close=True)
                        object.__setattr__(self, "_returned", True)
                        return

                    pool.putconn(conn)
            except Exception:
                try:
                    pool.putconn(conn, close=True)
                except Exception:
                    pass
            finally:
                object.__setattr__(self, "_returned", True)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            try:
                conn = object.__getattribute__(self, "_conn")
                if getattr(conn, "closed", 0) == 0:
                    conn.rollback()
            except Exception:
                pass
        self.close()
        return False


# ── Connection Helpers ──────────────────────────────────────────────────────────

def _is_connection_alive(raw_conn) -> bool:
    """Execute a quick pre-ping (SELECT 1) on a raw connection to verify liveness."""
    if not raw_conn or getattr(raw_conn, "closed", 0) != 0:
        return False
    try:
        with raw_conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        raw_conn.rollback()
        return True
    except Exception:
        return False


def get_conn(max_retries: int = 3):
    """
    Check out a connection from the thread-safe pool.
    Executes a pre-ping (SELECT 1) to validate liveness before returning.
    
    Self-healing capabilities:
      - Automatically detects stale / broken connections and discards them.
      - If multiple connections in the pool are broken, recreates the pool
        automatically to recover from serverless database pauses or network blips.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in the environment variables.")

    global _consecutive_pool_failures

    last_err = None
    for attempt in range(1, max_retries + 1):
        pool = None
        raw_conn = None
        try:
            pool = _get_pool(force_recreate=(_consecutive_pool_failures >= 3))
            raw_conn = pool.getconn()

            # Pre-ping liveness test
            if not _is_connection_alive(raw_conn):
                print(f"[DB] Stale connection detected on attempt {attempt}. Discarding...")
                try:
                    pool.putconn(raw_conn, close=True)
                except Exception:
                    pass
                raw_conn = None
                
                # Fetch another connection from pool
                raw_conn = pool.getconn()
                if not _is_connection_alive(raw_conn):
                    print(f"[DB] Second connection also dead on attempt {attempt}. Discarding and recycling pool...")
                    try:
                        pool.putconn(raw_conn, close=True)
                    except Exception:
                        pass
                    raw_conn = None
                    _consecutive_pool_failures += 1
                    time.sleep(0.2)
                    continue

            # Connection is healthy
            _consecutive_pool_failures = 0
            raw_conn.autocommit = False
            return PooledConnectionWrapper(raw_conn, pool)

        except Exception as e:
            last_err = e
            _consecutive_pool_failures += 1
            print(f"[DB] get_conn attempt {attempt}/{max_retries} failed: {e}")
            if raw_conn and pool:
                try:
                    pool.putconn(raw_conn, close=True)
                except Exception:
                    pass
            if attempt < max_retries:
                time.sleep(0.3 * attempt)

    raise RuntimeError(f"[DB] Failed to obtain a healthy database connection after {max_retries} attempts: {last_err}") from last_err


def is_postgres_active() -> bool:
    """Check if PostgreSQL connection pool is active, healthy, and queries succeed."""
    try:
        with get_conn(max_retries=2) as conn:
            with get_cursor(conn) as cur:
                cur.execute("SELECT 1")
                row = cur.fetchone()
                return row is not None
    except Exception:
        return False


def get_cursor(conn):
    """Returns a dictionary cursor for PostgreSQL."""
    return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)


def execute_sql(cur, sql, params=None):
    """Executes a SQL query, converting placeholders dynamically to PostgreSQL syntax."""
    if params is None:
        params = ()
    else:
        # Sanitize parameters to remove NUL bytes (psycopg2/Postgres crash prevention)
        new_params = []
        for p in params:
            if isinstance(p, str):
                new_params.append(p.replace("\x00", "").replace("\u0000", ""))
            else:
                new_params.append(p)
        params = tuple(new_params)

    # Convert SQLite ? placeholders to PostgreSQL %s placeholders
    sql = sql.replace("?", "%s")
    # Replace SQLite local timestamp function with standard Postgres timestamp
    sql = sql.replace("datetime('now', 'localtime')", "CURRENT_TIMESTAMP")
    cur.execute(sql, params)
    return cur



# ── Database Init ───────────────────────────────────────────────────────────────

def init_db():
    """Initialize all DB tables inside the Supabase PostgreSQL database."""
    with get_conn() as conn:
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
        CREATE INDEX IF NOT EXISTS document_embeddings_fts_gin_idx
        ON document_embeddings USING gin(to_tsvector('english', content));
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

        cur.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            default_model TEXT DEFAULT 'llama-70b',
            temperature REAL DEFAULT 0.1,
            system_prompt TEXT DEFAULT '',
            chunk_size INTEGER DEFAULT 800,
            chunk_overlap INTEGER DEFAULT 100
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS token_usage (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            model VARCHAR(100) NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            latency_ms INTEGER DEFAULT 0,
            estimated_cost_usd REAL DEFAULT 0.000000,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)


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
            cur.execute("ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;")
            cur.execute("ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;")
        except Exception as e:
            print(f"[WARN] Failed to enable RLS: {e}")

        conn.commit()


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


# ── User Settings Helpers ───────────────────────────────────────────────────────

def get_user_settings(user_id: int) -> dict:
    """Retrieve settings for a given user. Creates default record if missing."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, "SELECT default_model, temperature, system_prompt, chunk_size, chunk_overlap FROM user_settings WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        if row:
            try:
                return {
                    "default_model": row["default_model"],
                    "temperature": row["temperature"],
                    "system_prompt": row["system_prompt"],
                    "chunk_size": row["chunk_size"],
                    "chunk_overlap": row["chunk_overlap"]
                }
            except Exception:
                return {
                    "default_model": row[0],
                    "temperature": row[1],
                    "system_prompt": row[2],
                    "chunk_size": row[3],
                    "chunk_overlap": row[4]
                }
        else:
            # Create default settings
            execute_sql(cur, """
                INSERT INTO user_settings (user_id, default_model, temperature, system_prompt, chunk_size, chunk_overlap)
                VALUES (?, 'llama-70b', 0.1, '', 800, 100)
            """, (user_id,))
            conn.commit()
            return {
                "default_model": "llama-70b",
                "temperature": 0.1,
                "system_prompt": "",
                "chunk_size": 800,
                "chunk_overlap": 100
            }


def save_user_settings(user_id: int, settings: dict):
    """Save/update settings for a given user."""
    with get_conn() as conn:
        cur = get_cursor(conn)
        execute_sql(cur, "SELECT 1 FROM user_settings WHERE user_id = ?", (user_id,))
        exists = cur.fetchone()
        
        if exists:
            execute_sql(cur, """
                UPDATE user_settings 
                SET default_model = ?, temperature = ?, system_prompt = ?, chunk_size = ?, chunk_overlap = ?
                WHERE user_id = ?
            """, (
                settings.get("default_model", "llama-70b"),
                settings.get("temperature", 0.1),
                settings.get("system_prompt", ""),
                settings.get("chunk_size", 800),
                settings.get("chunk_overlap", 100),
                user_id
            ))
        else:
            execute_sql(cur, """
                INSERT INTO user_settings (user_id, default_model, temperature, system_prompt, chunk_size, chunk_overlap)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user_id,
                settings.get("default_model", "llama-70b"),
                settings.get("temperature", 0.1),
                settings.get("system_prompt", ""),
                settings.get("chunk_size", 800),
                settings.get("chunk_overlap", 100)
            ))
        conn.commit()


def log_token_usage(username: str, model: str, input_tokens: int, output_tokens: int, latency_ms: int):
    """
    Log token usage and calculate estimated cost.
    """
    model_lower = model.lower()
    in_rate = 0.0
    out_rate = 0.0
    
    if "llama" in model_lower:
        in_rate = 0.59 / 1_000_000
        out_rate = 0.79 / 1_000_000
    elif "pro" in model_lower:
        in_rate = 1.25 / 1_000_000
        out_rate = 5.00 / 1_000_000
    else: # Default is gemini-flash
        in_rate = 0.075 / 1_000_000
        out_rate = 0.30 / 1_000_000
        
    cost = (input_tokens * in_rate) + (output_tokens * out_rate)
    
    try:
        with get_conn() as conn:
            cur = get_cursor(conn)
            execute_sql(
                cur,
                "INSERT INTO token_usage (username, model, input_tokens, output_tokens, latency_ms, estimated_cost_usd) VALUES (?, ?, ?, ?, ?, ?)",
                (username, model, input_tokens, output_tokens, latency_ms, cost)
            )
            conn.commit()
    except Exception as e:
        print(f"[DB] Error logging token usage: {e}")



