import aiosqlite
import json
import uuid
from typing import Optional, Dict, Any, List
from app.config import get_settings

settings = get_settings()

async def init_db() -> None:
    """Initializes the SQLite database with required tables."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                filename TEXT,
                original_filename TEXT,
                uploaded_at TEXT,
                row_count INT,
                col_count INT,
                column_info TEXT,
                status TEXT DEFAULT 'uploaded'
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS analysis_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                stats_json TEXT,
                narrative_json TEXT,
                charts_json TEXT,
                created_at TEXT,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS share_tokens (
                token TEXT PRIMARY KEY,
                session_id TEXT,
                created_at TEXT,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
        ''')
        await db.commit()

async def create_session(original_filename: str, filename: str, uploaded_at: str, row_count: int, col_count: int, column_info: List[Dict[str, Any]]) -> str:
    """Creates a new session in the database."""
    session_id = str(uuid.uuid4())
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute(
            'INSERT INTO sessions (id, filename, original_filename, uploaded_at, row_count, col_count, column_info, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (session_id, filename, original_filename, uploaded_at, row_count, col_count, json.dumps(column_info), 'uploaded')
        )
        await db.commit()
    return session_id

async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a session by ID."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT * FROM sessions WHERE id = ?', (session_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                data = dict(row)
                if data.get('column_info'):
                    data['column_info'] = json.loads(data['column_info'])
                return data
            return None

async def update_session_status(session_id: str, status: str) -> None:
    """Updates the status of a session."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute('UPDATE sessions SET status = ? WHERE id = ?', (status, session_id))
        await db.commit()

async def save_results(session_id: str, stats: Dict[str, Any], narrative: Dict[str, Any], charts: List[Dict[str, Any]], created_at: str) -> None:
    """Saves the analysis results for a session."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute(
            'INSERT INTO analysis_results (session_id, stats_json, narrative_json, charts_json, created_at) VALUES (?, ?, ?, ?, ?)',
            (session_id, json.dumps(stats), json.dumps(narrative), json.dumps(charts), created_at)
        )
        await db.commit()

async def get_results(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the analysis results for a session."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT * FROM analysis_results WHERE session_id = ? ORDER BY id DESC LIMIT 1', (session_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    'id': row['id'],
                    'session_id': row['session_id'],
                    'stats': json.loads(row['stats_json']),
                    'narrative': json.loads(row['narrative_json']),
                    'charts': json.loads(row['charts_json']),
                    'created_at': row['created_at']
                }
            return None

async def create_share_token(session_id: str) -> str:
    """Creates a share token for a session and returns it."""
    token = uuid.uuid4().hex[:8]
    async with aiosqlite.connect(settings.DB_PATH) as db:
        await db.execute(
            'INSERT INTO share_tokens (token, session_id, created_at) VALUES (?, ?, ?)',
            (token, session_id, __import__('datetime').datetime.utcnow().isoformat())
        )
        await db.commit()
    return token

async def get_session_by_token(token: str) -> Optional[str]:
    """Returns the session_id for a given share token."""
    async with aiosqlite.connect(settings.DB_PATH) as db:
        async with db.execute('SELECT session_id FROM share_tokens WHERE token = ?', (token,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None
