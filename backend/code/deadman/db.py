from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

# Portable SQL: TEXT ids and ISO-8601 UTC timestamps, CHECK constraints, and explicit
# indexes so the same DDL translates to PostgreSQL with only type substitutions.
MIGRATIONS: tuple[str, ...] = (
    """
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        timezone TEXT,
        account_key_hash TEXT NOT NULL UNIQUE,
        check_in_interval_days INTEGER NOT NULL
            CHECK (check_in_interval_days BETWEEN 1 AND 365),
        switch_state TEXT NOT NULL DEFAULT 'inactive'
            CHECK (switch_state IN ('inactive', 'armed', 'triggered', 'archived')),
        last_check_in_at TEXT,
        next_deadline_at TEXT,
        battery_level REAL CHECK (battery_level IS NULL OR battery_level BETWEEN 0 AND 1),
        low_power_mode INTEGER,
        device_reported_at TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_users_state_deadline ON users (switch_state, next_deadline_at);

    CREATE TABLE auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        access_token_hash TEXT NOT NULL UNIQUE,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        access_expires_at TEXT NOT NULL,
        refresh_expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_user ON auth_sessions (user_id);
    CREATE INDEX idx_sessions_refresh_expiry ON auth_sessions (refresh_expires_at);

    CREATE TABLE emergency_contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        whatsapp INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (email IS NOT NULL OR phone IS NOT NULL),
        CHECK (whatsapp = 0 OR phone IS NOT NULL)
    );
    CREATE INDEX idx_contacts_user ON emergency_contacts (user_id);

    CREATE TABLE check_ins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        client_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        source TEXT NOT NULL,
        UNIQUE (user_id, client_id)
    );
    CREATE INDEX idx_check_ins_user_received ON check_ins (user_id, received_at);

    CREATE TABLE last_known_locations (
        user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m REAL,
        recorded_at TEXT NOT NULL,
        received_at TEXT NOT NULL
    );

    CREATE TABLE deadman_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        deadline_at TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('triggered', 'resolved')),
        resolved_at TEXT,
        last_check_in_at TEXT,
        latitude REAL,
        longitude REAL,
        accuracy_m REAL,
        location_recorded_at TEXT,
        address TEXT,
        battery_level REAL,
        location_purge_after TEXT NOT NULL,
        location_scrubbed_at TEXT,
        UNIQUE (user_id, deadline_at)
    );
    CREATE INDEX idx_events_user ON deadman_events (user_id, triggered_at);
    CREATE INDEX idx_events_purge ON deadman_events (location_purge_after);

    CREATE TABLE locations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_m REAL,
        recorded_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('check_in', 'foreground', 'background')),
        deadman_event_id TEXT REFERENCES deadman_events (id) ON DELETE SET NULL
    );
    CREATE INDEX idx_locations_user_recorded ON locations (user_id, recorded_at);
    CREATE INDEX idx_locations_recorded ON locations (recorded_at);
    CREATE INDEX idx_locations_event ON locations (deadman_event_id);

    CREATE TABLE notification_events (
        id TEXT PRIMARY KEY,
        deadman_event_id TEXT NOT NULL REFERENCES deadman_events (id) ON DELETE CASCADE,
        contact_id TEXT REFERENCES emergency_contacts (id) ON DELETE SET NULL,
        notification_type TEXT NOT NULL DEFAULT 'emergency_alert',
        channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
        recipient TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'cancelled')),
        retryable INTEGER NOT NULL DEFAULT 1,
        attempts INTEGER NOT NULL DEFAULT 0,
        provider_message_id TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        sent_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (deadman_event_id, contact_id, channel)
    );
    CREATE INDEX idx_notifications_status ON notification_events (status);
    CREATE INDEX idx_notifications_provider ON notification_events (provider_message_id);

    CREATE TABLE emergency_links (
        id TEXT PRIMARY KEY,
        deadman_event_id TEXT NOT NULL REFERENCES deadman_events (id) ON DELETE CASCADE,
        notification_event_id TEXT REFERENCES notification_events (id) ON DELETE SET NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        last_accessed_at TEXT
    );
    CREATE INDEX idx_links_expiry ON emergency_links (expires_at);
    CREATE INDEX idx_links_event ON emergency_links (deadman_event_id);

    CREATE TABLE archived_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        archived_at TEXT NOT NULL,
        purge_after TEXT NOT NULL
    );
    CREATE INDEX idx_archived_purge ON archived_profiles (purge_after);
    """,
)


def open_connection(db_path: str) -> sqlite3.Connection:
    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    # isolation_level=None: we manage transactions explicitly with BEGIN IMMEDIATE so
    # the API and worker processes serialize their writes.
    connection = sqlite3.connect(db_path, isolation_level=None, check_same_thread=False, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


def migrate(connection: sqlite3.Connection) -> None:
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    for index, script in enumerate(MIGRATIONS[version:], start=version + 1):
        connection.executescript(f"BEGIN;\n{script}\nPRAGMA user_version = {index};\nCOMMIT;")


def connect(db_path: str) -> sqlite3.Connection:
    connection = open_connection(db_path)
    if db_path != ":memory:":
        connection.execute("PRAGMA journal_mode = WAL")
    migrate(connection)
    return connection


@contextmanager
def transaction(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    connection.execute("BEGIN IMMEDIATE")
    try:
        yield connection
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    connection.execute("COMMIT")
