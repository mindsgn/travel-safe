"""Emergency links.

Each notification gets its own link token. Only the SHA-256 hash is stored, so a
database leak does not expose working links, and a single recipient's link can be
revoked without affecting others.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime

from deadman.security import hash_secret, new_id, new_link_token
from deadman.timeutil import from_db, to_db


def mint_link(
    connection: sqlite3.Connection,
    *,
    event_id: str,
    notification_id: str | None,
    expires_at: datetime,
    now: datetime,
) -> str:
    """Caller owns the transaction. Returns the raw token (never persisted)."""
    token = new_link_token()
    connection.execute(
        """
        INSERT INTO emergency_links (id, deadman_event_id, notification_event_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (new_id(), event_id, notification_id, hash_secret(token), to_db(now), to_db(expires_at)),
    )
    return token


def resolve_link(connection: sqlite3.Connection, token: str, now: datetime) -> sqlite3.Row | None:
    """Return the link row if the token is valid, unexpired, unrevoked and the user is active."""
    if not token or len(token) > 128:
        return None
    row = connection.execute(
        """
        SELECT l.id AS link_id, l.expires_at, l.deadman_event_id
        FROM emergency_links l
        JOIN deadman_events e ON e.id = l.deadman_event_id
        JOIN users u ON u.id = e.user_id
        WHERE l.token_hash = ? AND l.revoked_at IS NULL AND u.archived_at IS NULL
        """,
        (hash_secret(token),),
    ).fetchone()
    if row is None:
        return None
    expires_at = from_db(row["expires_at"])
    if expires_at is None or expires_at <= now:
        return None
    connection.execute(
        "UPDATE emergency_links SET last_accessed_at = ? WHERE id = ?", (to_db(now), row["link_id"])
    )
    return row
