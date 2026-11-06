"""Share storage (ADR-011): create, get, delete, purge-expired — nothing else.

Raw share/delete tokens are never stored, only their SHA-256 hashes, so a
database dump yields no working links (SECURITY.md §N). SQLite through the
standard library keeps dependencies at zero; if the T6 host picks Postgres,
only this module's internals change.

Connections are opened per operation and closed immediately — the store is
used from FastAPI's threadpool, never from the event loop.
"""

import hashlib
import logging
import secrets
from contextlib import closing
from datetime import UTC, datetime, timedelta
from sqlite3 import Connection

import sqlite3

from app.core.config import settings
from app.core.exceptions import SharesUnavailableError

logger = logging.getLogger("transcora.shares")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS shares (
    token_hash   TEXT PRIMARY KEY,
    delete_hash  TEXT NOT NULL,
    video_id     TEXT NOT NULL,
    language_code TEXT,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    payload      TEXT NOT NULL,
    bytes        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
"""


def configured() -> bool:
    return settings.database_url.startswith("sqlite:///")


def _connect() -> Connection:
    if not configured():
        raise SharesUnavailableError()
    conn = sqlite3.connect(settings.database_url.removeprefix("sqlite:///"), timeout=5)
    conn.executescript(_SCHEMA)
    return conn


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _purge_expired(conn: Connection) -> None:
    conn.execute("DELETE FROM shares WHERE expires_at <= ?", (datetime.now(UTC).isoformat(),))


def create(video_id: str, language_code: str | None, payload_json: str) -> tuple[str, str, datetime]:
    """Stores the payload and returns (share token, delete token, expiry)."""
    token = secrets.token_urlsafe(32)  # 256-bit CSPRNG, ≥128-bit requirement
    delete_token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.share_ttl_days)
    with closing(_connect()) as conn:
        _purge_expired(conn)
        conn.execute(
            "INSERT INTO shares (token_hash, delete_hash, video_id, language_code,"
            " created_at, expires_at, payload, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                _hash(token),
                _hash(delete_token),
                video_id,
                language_code,
                now.isoformat(),
                expires_at.isoformat(),
                payload_json,
                len(payload_json.encode("utf-8")),
            ),
        )
        conn.commit()
    return token, delete_token, expires_at


def get(token: str) -> str | None:
    """Returns the stored payload JSON, or None for unknown/expired tokens —
    both take the caller's identical 404 path (SECURITY.md §N)."""
    if not token:
        return None
    with closing(_connect()) as conn:
        _purge_expired(conn)
        conn.commit()
        row = conn.execute(
            "SELECT payload FROM shares WHERE token_hash = ?", (_hash(token),)
        ).fetchone()
    return row[0] if row else None


def delete(token: str, delete_token: str) -> bool:
    """Removes the row immediately when both hashes match; no recovery."""
    if not token or not delete_token:
        return False
    with closing(_connect()) as conn:
        cursor = conn.execute(
            "DELETE FROM shares WHERE token_hash = ? AND delete_hash = ?",
            (_hash(token), _hash(delete_token)),
        )
        conn.commit()
    return cursor.rowcount > 0
