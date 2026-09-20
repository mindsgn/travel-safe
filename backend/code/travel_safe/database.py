from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS location_pings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_meters REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (device_code) REFERENCES devices(code)
);

CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    origin_latitude REAL NOT NULL,
    origin_longitude REAL NOT NULL,
    destination_latitude REAL NOT NULL,
    destination_longitude REAL NOT NULL,
    provider TEXT NOT NULL,
    distance_meters REAL NOT NULL,
    created_at TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect(db_path: str) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA)
    connection.commit()
    return connection


def upsert_device(connection: sqlite3.Connection, device_code: str) -> None:
    connection.execute(
        "INSERT OR IGNORE INTO devices (code, created_at) VALUES (?, ?)",
        (device_code, utc_now()),
    )
    connection.commit()


def save_location(
    connection: sqlite3.Connection,
    device_code: str,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None,
) -> None:
    upsert_device(connection, device_code)
    connection.execute(
        """
        INSERT INTO location_pings (device_code, latitude, longitude, accuracy_meters, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (device_code, latitude, longitude, accuracy_meters, utc_now()),
    )
    connection.commit()


def save_trip(
    connection: sqlite3.Connection,
    device_code: str | None,
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
    provider: str,
    distance_meters: float,
) -> None:
    if device_code:
        upsert_device(connection, device_code)
    connection.execute(
        """
        INSERT INTO trips (
            device_code, origin_latitude, origin_longitude,
            destination_latitude, destination_longitude, provider, distance_meters, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            device_code,
            origin_latitude,
            origin_longitude,
            destination_latitude,
            destination_longitude,
            provider,
            distance_meters,
            utc_now(),
        ),
    )
    connection.commit()


def count_location_pings(connection: sqlite3.Connection, device_code: str) -> int:
    row = connection.execute(
        "SELECT COUNT(*) AS n FROM location_pings WHERE device_code = ?",
        (device_code,),
    ).fetchone()
    return int(row["n"]) if row else 0
