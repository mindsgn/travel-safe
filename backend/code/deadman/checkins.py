from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.errors import NotFoundError
from deadman.locations import LocationPoint, save_points
from deadman.security import new_id
from deadman.switch import compute_deadline
from deadman.timeutil import to_db


@dataclass(frozen=True)
class DeviceState:
    battery_level: float | None
    low_power_mode: bool | None


@dataclass(frozen=True)
class CheckInResult:
    check_in: dict
    created: bool
    resolved_event_ids: list[str]


def _check_in_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "client_id": row["client_id"],
        "occurred_at": row["occurred_at"],
        "received_at": row["received_at"],
        "deadline_at": row["deadline_at"],
        "source": row["source"],
    }


def update_device_state(
    connection: sqlite3.Connection, user_id: str, device: DeviceState | None, now: datetime
) -> None:
    """Caller owns the transaction."""
    if device is None:
        return
    connection.execute(
        "UPDATE users SET battery_level = ?, low_power_mode = ?, device_reported_at = ? WHERE id = ?",
        (
            device.battery_level,
            None if device.low_power_mode is None else int(device.low_power_mode),
            to_db(now),
            user_id,
        ),
    )


def record_check_in(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    client_id: str,
    occurred_at: datetime,
    now: datetime,
    settings: Settings,
    location: LocationPoint | None = None,
    device: DeviceState | None = None,
    source: str = "app",
) -> CheckInResult:
    """Record a check-in idempotently (keyed by the client-generated id).

    The deadline is computed from the server's receive time, not the device clock:
    the backend is authoritative, and a skewed or tampered clock must not extend it.
    """
    with transaction(connection):
        existing = connection.execute(
            "SELECT * FROM check_ins WHERE user_id = ? AND client_id = ?", (user_id, client_id)
        ).fetchone()
        if existing is not None:
            return CheckInResult(_check_in_dict(existing), created=False, resolved_event_ids=[])

        user = connection.execute(
            "SELECT check_in_interval_days, switch_state FROM users WHERE id = ? AND archived_at IS NULL",
            (user_id,),
        ).fetchone()
        if user is None:
            raise NotFoundError("user_not_found")

        deadline = compute_deadline(now, int(user["check_in_interval_days"]))
        check_in_id = new_id()
        connection.execute(
            """
            INSERT INTO check_ins (id, user_id, client_id, occurred_at, received_at, deadline_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                check_in_id,
                user_id,
                client_id,
                to_db(min(occurred_at, now)),
                to_db(now),
                to_db(deadline),
                source,
            ),
        )

        resolved: list[str] = []
        if user["switch_state"] == "triggered":
            resolved = [
                row["id"]
                for row in connection.execute(
                    "SELECT id FROM deadman_events WHERE user_id = ? AND status = 'triggered'", (user_id,)
                ).fetchall()
            ]
            connection.execute(
                """
                UPDATE deadman_events SET status = 'resolved', resolved_at = ?
                WHERE user_id = ? AND status = 'triggered'
                """,
                (to_db(now), user_id),
            )
        if resolved:
            connection.execute(
                f"""
                UPDATE notification_events SET status = 'cancelled', updated_at = ?
                WHERE status = 'pending' AND deadman_event_id IN ({",".join("?" * len(resolved))})
                """,
                (to_db(now), *resolved),
            )

        connection.execute(
            """
            UPDATE users
            SET last_check_in_at = ?, next_deadline_at = ?, switch_state = 'armed', updated_at = ?
            WHERE id = ?
            """,
            (to_db(now), to_db(deadline), to_db(now), user_id),
        )
        if location is not None:
            save_points(connection, user_id, [location], "check_in", now, settings)
        update_device_state(connection, user_id, device, now)

        row = connection.execute("SELECT * FROM check_ins WHERE id = ?", (check_in_id,)).fetchone()
    return CheckInResult(_check_in_dict(row), created=True, resolved_event_ids=resolved)


def latest_check_in(connection: sqlite3.Connection, user_id: str) -> dict | None:
    row = connection.execute(
        "SELECT * FROM check_ins WHERE user_id = ? ORDER BY received_at DESC LIMIT 1", (user_id,)
    ).fetchone()
    return _check_in_dict(row) if row else None
