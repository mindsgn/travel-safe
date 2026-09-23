"""Retention policy. Every function is a set-based DELETE/UPDATE and safe to re-run.

- Journey points: deleted 24h after they were recorded, unless tagged to an event whose
  location retention has not yet elapsed.
- Event location snapshots: scrubbed once location_purge_after passes (link TTL).
- Emergency links: deleted once expired.
- Archived profiles: hard-deleted (cascading to all user data) after 90 days.
- Auth sessions: deleted once the refresh token has expired.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.timeutil import to_db


@dataclass(frozen=True)
class CleanupSummary:
    locations_deleted: int
    events_scrubbed: int
    links_deleted: int
    profiles_purged: int
    sessions_deleted: int


def cleanup_locations(connection: sqlite3.Connection, now: datetime, settings: Settings) -> int:
    with transaction(connection):
        cursor = connection.execute(
            """
            DELETE FROM locations
            WHERE recorded_at < ?
              AND (
                deadman_event_id IS NULL
                OR deadman_event_id IN (SELECT id FROM deadman_events WHERE location_purge_after <= ?)
              )
            """,
            (to_db(now - settings.location_retention), to_db(now)),
        )
    return cursor.rowcount


def scrub_event_locations(connection: sqlite3.Connection, now: datetime) -> int:
    with transaction(connection):
        cursor = connection.execute(
            """
            UPDATE deadman_events
            SET latitude = NULL, longitude = NULL, accuracy_m = NULL, address = NULL, location_scrubbed_at = ?
            WHERE location_purge_after <= ? AND location_scrubbed_at IS NULL
            """,
            (to_db(now), to_db(now)),
        )
    return cursor.rowcount


def cleanup_links(connection: sqlite3.Connection, now: datetime) -> int:
    with transaction(connection):
        cursor = connection.execute("DELETE FROM emergency_links WHERE expires_at <= ?", (to_db(now),))
    return cursor.rowcount


def purge_archived_profiles(connection: sqlite3.Connection, now: datetime) -> int:
    with transaction(connection):
        cursor = connection.execute(
            "DELETE FROM users WHERE id IN (SELECT user_id FROM archived_profiles WHERE purge_after <= ?)",
            (to_db(now),),
        )
    return cursor.rowcount


def cleanup_sessions(connection: sqlite3.Connection, now: datetime) -> int:
    with transaction(connection):
        cursor = connection.execute("DELETE FROM auth_sessions WHERE refresh_expires_at <= ?", (to_db(now),))
    return cursor.rowcount


def run_cleanup(connection: sqlite3.Connection, now: datetime, settings: Settings) -> CleanupSummary:
    return CleanupSummary(
        locations_deleted=cleanup_locations(connection, now, settings),
        events_scrubbed=scrub_event_locations(connection, now),
        links_deleted=cleanup_links(connection, now),
        profiles_purged=purge_archived_profiles(connection, now),
        sessions_deleted=cleanup_sessions(connection, now),
    )
