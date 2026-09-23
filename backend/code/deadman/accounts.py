"""Passwordless, device-bound accounts.

Registration returns a high-entropy account key that the app keeps in the device's
secure enclave-backed store. It is only used to mint new sessions when the refresh
token has expired, so the app keeps working even with a one-year check-in interval.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.errors import AuthError
from deadman.security import hash_secret, new_id, new_secret, secrets_match
from deadman.timeutil import from_db, to_db


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime


@dataclass(frozen=True)
class Registration:
    user_id: str
    account_key: str
    tokens: TokenPair


def _new_tokens(now: datetime, settings: Settings) -> TokenPair:
    return TokenPair(
        access_token=new_secret("at"),
        refresh_token=new_secret("rt"),
        access_expires_at=now + settings.access_token_ttl,
        refresh_expires_at=now + settings.refresh_token_ttl,
    )


def _insert_session(
    connection: sqlite3.Connection, user_id: str, now: datetime, settings: Settings
) -> TokenPair:
    tokens = _new_tokens(now, settings)
    connection.execute(
        """
        INSERT INTO auth_sessions (
            id, user_id, access_token_hash, refresh_token_hash,
            access_expires_at, refresh_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(),
            user_id,
            hash_secret(tokens.access_token),
            hash_secret(tokens.refresh_token),
            to_db(tokens.access_expires_at),
            to_db(tokens.refresh_expires_at),
            to_db(now),
            to_db(now),
        ),
    )
    return tokens


def register(
    connection: sqlite3.Connection,
    *,
    name: str,
    interval_days: int,
    timezone: str | None,
    now: datetime,
    settings: Settings,
) -> Registration:
    user_id = new_id()
    account_key = new_secret("ak")
    with transaction(connection):
        connection.execute(
            """
            INSERT INTO users (
                id, name, timezone, account_key_hash, check_in_interval_days,
                switch_state, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'inactive', ?, ?)
            """,
            (user_id, name, timezone, hash_secret(account_key), interval_days, to_db(now), to_db(now)),
        )
        tokens = _insert_session(connection, user_id, now, settings)
    return Registration(user_id=user_id, account_key=account_key, tokens=tokens)


def login(
    connection: sqlite3.Connection, *, user_id: str, account_key: str, now: datetime, settings: Settings
) -> TokenPair:
    row = connection.execute(
        "SELECT account_key_hash, archived_at FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if row is None or row["archived_at"] is not None:
        raise AuthError("invalid_credentials")
    if not secrets_match(account_key, row["account_key_hash"]):
        raise AuthError("invalid_credentials")
    with transaction(connection):
        return _insert_session(connection, user_id, now, settings)


def refresh(
    connection: sqlite3.Connection, *, refresh_token: str, now: datetime, settings: Settings
) -> TokenPair:
    tokens = _new_tokens(now, settings)
    with transaction(connection):
        # Rotation is a single conditional UPDATE, so a refresh token can only be used once.
        cursor = connection.execute(
            """
            UPDATE auth_sessions
            SET access_token_hash = ?, refresh_token_hash = ?,
                access_expires_at = ?, refresh_expires_at = ?, updated_at = ?
            WHERE refresh_token_hash = ? AND refresh_expires_at > ?
              AND user_id IN (SELECT id FROM users WHERE archived_at IS NULL)
            """,
            (
                hash_secret(tokens.access_token),
                hash_secret(tokens.refresh_token),
                to_db(tokens.access_expires_at),
                to_db(tokens.refresh_expires_at),
                to_db(now),
                hash_secret(refresh_token),
                to_db(now),
            ),
        )
        if cursor.rowcount != 1:
            raise AuthError("invalid_refresh_token")
    return tokens


def logout(connection: sqlite3.Connection, *, access_token: str) -> None:
    with transaction(connection):
        connection.execute(
            "DELETE FROM auth_sessions WHERE access_token_hash = ?", (hash_secret(access_token),)
        )


def authenticate(connection: sqlite3.Connection, *, access_token: str, now: datetime) -> str:
    row = connection.execute(
        """
        SELECT s.user_id, s.access_expires_at
        FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.access_token_hash = ? AND u.archived_at IS NULL
        """,
        (hash_secret(access_token),),
    ).fetchone()
    if row is None:
        raise AuthError("invalid_token")
    expires_at = from_db(row["access_expires_at"])
    if expires_at is None or expires_at <= now:
        raise AuthError("token_expired")
    return str(row["user_id"])
