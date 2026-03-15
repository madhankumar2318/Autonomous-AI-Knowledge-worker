import sqlite3
import os

# ✅ Define DB path
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "app.db")

# ✅ Ensure the data folder exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


# ------------------------- CONNECTION HELPERS -------------------------
def get_conn():
    """Open SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ------------------------- DATABASE INIT -------------------------
def init_db():
    """Initialize all DB tables."""
    conn = get_conn()
    cur = conn.cursor()

    # ✅ Users Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
    """)

    # ✅ Reports Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news TEXT,
        stock TEXT,
        insights TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ✅ Uploads Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        filepath TEXT,
        size INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ✅ History Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        action TEXT,
        details TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # ✅ Insert a default admin if not present
    cur.execute("SELECT COUNT(*) FROM users WHERE username='admin'")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            ("admin", "1234")
        )
        print("✅ Default admin user created (username: admin, password: 1234)")

    conn.commit()
    conn.close()


# ------------------------- HISTORY LOGGER -------------------------
# ------------------------- HISTORY LOGGER -------------------------
def insert_history(username: str, action: str, details: str = ""):
    """Insert a record into the history table."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO history (username, action, details, timestamp) VALUES (?, ?, ?, datetime('now', 'localtime'))",
        (username, action, details)
    )
    conn.commit()
    conn.close()


# ------------------------- REPORTS -------------------------
def insert_report(news: str, stock: str, insights: str):
    """Insert generated report into reports table."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO reports (news, stock, insights) VALUES (?, ?, ?)",
        (news, stock, insights)
    )
    conn.commit()
    conn.close()


# ------------------------- GENERIC QUERY HELPER -------------------------
def log_action(action: str):
    """Simple history log (without username)."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO history (action) VALUES (?)", (action,))
    conn.commit()
    conn.close()
