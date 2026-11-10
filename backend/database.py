"""SQLite / SQLAlchemy database helpers with automatic schema initialization."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from backend.config import get_settings
from data.seed_db import seed_database


def ensure_database_ready(db_path: Path | None = None) -> Path:
    """Ensure SQLite DB exists, has all 12+ schema tables, and is populated."""
    target = db_path or get_settings().db_path
    if not target.exists():
        seed_database(target, force_reset=False)
        return target

    conn = sqlite3.connect(str(target))
    try:
        row = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Darkstore'"
        ).fetchone()
        if not row or row[0] == 0:
            conn.close()
            seed_database(target, force_reset=False)
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return target


@contextmanager
def get_connection(db_path: Path | None = None, read_only: bool = False) -> Iterator[sqlite3.Connection]:
    """Yield a sqlite3 connection with row factory cleanly closed on exit."""
    target = ensure_database_ready(db_path)
    if read_only:
        uri = f"file:{target.as_posix()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    else:
        conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

