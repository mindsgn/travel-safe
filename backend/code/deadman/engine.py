"""Travel Safe engine: the authoritative expiry decision.

Idempotency is enforced at three levels so repeated or concurrent worker runs can
never double-notify:
1. the user row flips armed -> triggered with a conditional UPDATE (rowcount check);
2. deadman_events has UNIQUE (user_id, deadline_at);
3. notification_events has UNIQUE (deadman_event_id, contact_id, channel).
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.geocoding import ReverseGeocoder
from deadman.security import new_id
from deadman.timeutil import to_db

logger = logging.getLogger(__name__)


def channels_for_contact(email: str | None, phone: str | None) -> list[str]:
    channels: list[str] = []
    if email:
        channels.append("email")
    if phone:
        channels.append("whatsapp")
    return channels


def find_expired_users(connection: sqlite3.Connection, now: datetime) -> list[str]:
    rows = connection.execute(
        """
        SELECT id FROM users
        WHERE switch_state = 'armed' AND archived_at IS NULL
          AND next_deadline_at IS NOT NULL AND next_deadline_at < ?
        ORDER BY next_deadline_at
        """,
        (to_db(now),),
    ).fetchall()
    return [row["id"] for row in rows]


def trigger_user(
    connection: sqlite3.Connection, user_id: str, now: datetime, settings: Settings
) -> str | None:
    """Trigger one user's switch. Returns the new event id, or None if nothing to do."""
    with transaction(connection):
        user = connection.execute(
            "SELECT * FROM users WHERE id = ? AND switch_state = 'armed' AND archived_at IS NULL "
            "AND next_deadline_at < ?",
            (user_id, to_db(now)),
        ).fetchone()
        if user is None:
            return None
        cursor = connection.execute(
            "UPDATE users SET switch_state = 'triggered', updated_at = ? WHERE id = ? AND switch_state = 'armed'",
            (to_db(now), user_id),
        )
        if cursor.rowcount != 1:
            return None

        location = connection.execute(
            "SELECT * FROM last_known_locations WHERE user_id = ?", (user_id,)
        ).fetchone()
        event_id = new_id()
        cursor = connection.execute(
            """
            INSERT OR IGNORE INTO deadman_events (
                id, user_id, deadline_at, triggered_at, status, last_check_in_at,
                latitude, longitude, accuracy_m, location_recorded_at, battery_level, location_purge_after
            ) VALUES (?, ?, ?, ?, 'triggered', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                user_id,
                user["next_deadline_at"],
                to_db(now),
                user["last_check_in_at"],
                location["latitude"] if location else None,
                location["longitude"] if location else None,
                location["accuracy_m"] if location else None,
                location["recorded_at"] if location else None,
                user["battery_level"],
                to_db(now + settings.emergency_link_ttl),
            ),
        )
        if cursor.rowcount != 1:
            return None

        # Keep the journey leading up to the event beyond the normal 24h retention.
        connection.execute(
            """
            UPDATE locations SET deadman_event_id = ?
            WHERE user_id = ? AND deadman_event_id IS NULL AND recorded_at >= ?
            """,
            (event_id, user_id, to_db(now - settings.location_retention)),
        )

        contacts = connection.execute(
            "SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY created_at", (user_id,)
        ).fetchall()
        for contact in contacts:
            for channel in channels_for_contact(contact["email"], contact["phone"]):
                connection.execute(
                    """
                    INSERT OR IGNORE INTO notification_events (
                        id, deadman_event_id, contact_id, channel, recipient, recipient_name,
                        status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                    """,
                    (
                        new_id(),
                        event_id,
                        contact["id"],
                        channel,
                        contact["email"] if channel == "email" else contact["phone"],
                        contact["name"],
                        to_db(now),
                        to_db(now),
                    ),
                )
    logger.info("Travel Safe triggered for user %s (event %s)", user_id, event_id)
    return event_id


def attach_address(
    connection: sqlite3.Connection, event_id: str, geocoder: ReverseGeocoder
) -> str | None:
    event = connection.execute(
        "SELECT latitude, longitude, address FROM deadman_events WHERE id = ?", (event_id,)
    ).fetchone()
    if event is None or event["latitude"] is None or event["address"] is not None:
        return None
    address = geocoder.reverse(event["latitude"], event["longitude"])
    if address:
        with transaction(connection):
            connection.execute(
                "UPDATE deadman_events SET address = ? WHERE id = ? AND address IS NULL", (address, event_id)
            )
    return address


def process_expired(
    connection: sqlite3.Connection, now: datetime, settings: Settings, geocoder: ReverseGeocoder
) -> list[str]:
    triggered: list[str] = []
    for user_id in find_expired_users(connection, now):
        event_id = trigger_user(connection, user_id, now, settings)
        if event_id is None:
            continue
        triggered.append(event_id)
        attach_address(connection, event_id, geocoder)
    return triggered


def latest_event_status(connection: sqlite3.Connection, user_id: str) -> dict | None:
    event = connection.execute(
        "SELECT * FROM deadman_events WHERE user_id = ? ORDER BY triggered_at DESC LIMIT 1", (user_id,)
    ).fetchone()
    if event is None:
        return None
    notifications = connection.execute(
        """
        SELECT id, channel, recipient_name, status, failure_reason, sent_at, attempts
        FROM notification_events WHERE deadman_event_id = ? ORDER BY created_at, channel
        """,
        (event["id"],),
    ).fetchall()
    return {
        "id": event["id"],
        "status": event["status"],
        "deadline_at": event["deadline_at"],
        "triggered_at": event["triggered_at"],
        "resolved_at": event["resolved_at"],
        "notifications": [
            {
                "id": row["id"],
                "channel": row["channel"],
                "recipient_name": row["recipient_name"],
                "status": row["status"],
                "failure_reason": row["failure_reason"],
                "sent_at": row["sent_at"],
            }
            for row in notifications
        ],
    }
