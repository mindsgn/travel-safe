from __future__ import annotations

import sqlite3
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.errors import ConflictError, NotFoundError, ValidationFailed
from deadman.switch import compute_deadline, is_expired, seconds_remaining, validate_interval
from deadman.timeutil import from_db, to_db

MAX_NAME_LENGTH = 100


def validate_name(name: str) -> str:
    clean = name.strip()
    if not clean:
        raise ValidationFailed("missing_name", "Name is required.", "name")
    if len(clean) > MAX_NAME_LENGTH:
        raise ValidationFailed("name_too_long", "Name is too long.", "name")
    return clean


def _load_user(connection: sqlite3.Connection, user_id: str) -> sqlite3.Row:
    row = connection.execute(
        "SELECT * FROM users WHERE id = ? AND archived_at IS NULL", (user_id,)
    ).fetchone()
    if row is None:
        raise NotFoundError("user_not_found")
    return row


def get_profile(connection: sqlite3.Connection, user_id: str) -> dict:
    row = _load_user(connection, user_id)
    return {
        "id": row["id"],
        "name": row["name"],
        "timezone": row["timezone"],
        "check_in_interval_days": row["check_in_interval_days"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def update_profile(
    connection: sqlite3.Connection,
    user_id: str,
    *,
    now: datetime,
    name: str | None = None,
    timezone: str | None = None,
    interval_days: int | None = None,
) -> dict:
    with transaction(connection):
        user = _load_user(connection, user_id)
        new_name = validate_name(name) if name is not None else user["name"]
        new_zone = timezone if timezone is not None else user["timezone"]
        new_interval = user["check_in_interval_days"]
        new_deadline = user["next_deadline_at"]
        if interval_days is not None:
            try:
                new_interval = validate_interval(interval_days)
            except ValueError as error:
                raise ValidationFailed("invalid_interval", str(error), "check_in_interval_days") from error
            last_check_in = from_db(user["last_check_in_at"])
            if last_check_in is not None and user["switch_state"] == "armed":
                deadline = compute_deadline(last_check_in, new_interval)
                if is_expired(deadline, now):
                    raise ConflictError(
                        "interval_would_expire",
                        "This interval would put your deadline in the past. Check in first, then change it.",
                    )
                new_deadline = to_db(deadline)
        connection.execute(
            """
            UPDATE users SET name = ?, timezone = ?, check_in_interval_days = ?, next_deadline_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (new_name, new_zone, new_interval, new_deadline, to_db(now), user_id),
        )
    return get_profile(connection, user_id)


def archive_profile(
    connection: sqlite3.Connection, user_id: str, *, now: datetime, settings: Settings
) -> datetime:
    """Stop monitoring, drop location data immediately, and schedule a hard delete."""
    purge_after = now + settings.archive_retention
    with transaction(connection):
        _load_user(connection, user_id)
        connection.execute(
            """
            UPDATE users SET archived_at = ?, switch_state = 'archived', next_deadline_at = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (to_db(now), to_db(now), user_id),
        )
        connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
        connection.execute("DELETE FROM last_known_locations WHERE user_id = ?", (user_id,))
        connection.execute("DELETE FROM locations WHERE user_id = ?", (user_id,))
        connection.execute(
            """
            UPDATE deadman_events SET latitude = NULL, longitude = NULL, accuracy_m = NULL, address = NULL,
                location_scrubbed_at = ?
            WHERE user_id = ?
            """,
            (to_db(now), user_id),
        )
        connection.execute(
            """
            UPDATE notification_events SET status = 'cancelled', updated_at = ?
            WHERE status IN ('pending', 'failed')
              AND deadman_event_id IN (SELECT id FROM deadman_events WHERE user_id = ?)
            """,
            (to_db(now), user_id),
        )
        connection.execute(
            "UPDATE emergency_links SET revoked_at = ? WHERE revoked_at IS NULL AND deadman_event_id IN "
            "(SELECT id FROM deadman_events WHERE user_id = ?)",
            (to_db(now), user_id),
        )
        connection.execute(
            "INSERT INTO archived_profiles (user_id, archived_at, purge_after) VALUES (?, ?, ?)",
            (user_id, to_db(now), to_db(purge_after)),
        )
    return purge_after


def switch_status(connection: sqlite3.Connection, user_id: str, now: datetime) -> dict:
    user = _load_user(connection, user_id)
    deadline = from_db(user["next_deadline_at"])
    contacts = connection.execute(
        "SELECT COUNT(*) FROM emergency_contacts WHERE user_id = ?", (user_id,)
    ).fetchone()[0]
    return {
        "state": user["switch_state"],
        "check_in_interval_days": user["check_in_interval_days"],
        "last_check_in_at": user["last_check_in_at"],
        "next_deadline_at": user["next_deadline_at"],
        "seconds_remaining": seconds_remaining(deadline, now),
        "deadline_passed": is_expired(deadline, now),
        "contact_count": contacts,
        "server_time": to_db(now),
    }
