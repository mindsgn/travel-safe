"""Location storage.

Three kinds of location data are kept apart:
- last known location: one overwritten row per active user, the core safety data;
- journey points: short-lived history, deleted after the retention window (24h);
- event locations: a snapshot on the deadman event plus journey points tagged with the
  event id, kept until the event's location_purge_after timestamp.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta

from deadman.config import Settings
from deadman.db import transaction
from deadman.security import new_id
from deadman.timeutil import to_db

MAX_CLOCK_SKEW = timedelta(minutes=5)
LOCATION_SOURCES = ("check_in", "foreground", "background")


@dataclass(frozen=True)
class LocationPoint:
    latitude: float
    longitude: float
    accuracy_m: float | None
    recorded_at: datetime


def clamp_recorded_at(recorded_at: datetime, now: datetime) -> datetime:
    return now if recorded_at > now + MAX_CLOCK_SKEW else min(recorded_at, now)


def save_points(
    connection: sqlite3.Connection,
    user_id: str,
    points: list[LocationPoint],
    source: str,
    now: datetime,
    settings: Settings,
) -> int:
    """Caller owns the transaction. Returns the number of journey points stored."""
    if source not in LOCATION_SOURCES:
        raise ValueError(f"unknown location source {source}")
    cutoff = now - settings.location_retention
    stored = 0
    newest: LocationPoint | None = None
    for point in points:
        recorded_at = clamp_recorded_at(point.recorded_at, now)
        clean = LocationPoint(point.latitude, point.longitude, point.accuracy_m, recorded_at)
        if newest is None or clean.recorded_at > newest.recorded_at:
            newest = clean
        if recorded_at < cutoff:
            continue
        connection.execute(
            """
            INSERT INTO locations (id, user_id, latitude, longitude, accuracy_m, recorded_at, received_at, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                user_id,
                clean.latitude,
                clean.longitude,
                clean.accuracy_m,
                to_db(recorded_at),
                to_db(now),
                source,
            ),
        )
        stored += 1
    if newest is not None:
        connection.execute(
            """
            INSERT INTO last_known_locations (user_id, latitude, longitude, accuracy_m, recorded_at, received_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                accuracy_m = excluded.accuracy_m,
                recorded_at = excluded.recorded_at,
                received_at = excluded.received_at
            WHERE excluded.recorded_at >= last_known_locations.recorded_at
            """,
            (
                user_id,
                newest.latitude,
                newest.longitude,
                newest.accuracy_m,
                to_db(newest.recorded_at),
                to_db(now),
            ),
        )
    return stored


def upload_points(
    connection: sqlite3.Connection,
    user_id: str,
    points: list[LocationPoint],
    source: str,
    now: datetime,
    settings: Settings,
) -> int:
    with transaction(connection):
        return save_points(connection, user_id, points, source, now, settings)


def get_last_known(connection: sqlite3.Connection, user_id: str) -> dict | None:
    row = connection.execute(
        "SELECT latitude, longitude, accuracy_m, recorded_at FROM last_known_locations WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None
