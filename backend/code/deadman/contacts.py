from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.errors import ConflictError, NotFoundError, ValidationFailed
from deadman.security import new_id
from deadman.timeutil import to_db

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")
PHONE_SEPARATORS = re.compile(r"[\s\-().]")
MAX_NAME_LENGTH = 100
MAX_EMAIL_LENGTH = 254


@dataclass(frozen=True)
class ContactInput:
    name: str
    email: str | None
    phone: str | None
    whatsapp: bool


def normalize_email(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    email = raw.strip().lower()
    if len(email) > MAX_EMAIL_LENGTH or not EMAIL_PATTERN.match(email):
        raise ValidationFailed("invalid_email", "Enter a valid email address.", "email")
    return email


def normalize_phone(raw: str | None) -> str | None:
    if raw is None or not raw.strip():
        return None
    phone = PHONE_SEPARATORS.sub("", raw.strip())
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if not E164_PATTERN.match(phone):
        raise ValidationFailed(
            "invalid_phone", "Enter the number in international format, e.g. +27821234567.", "phone"
        )
    return phone


def validate_contact(name: str, email: str | None, phone: str | None, whatsapp: bool) -> ContactInput:
    clean_name = name.strip()
    if not clean_name:
        raise ValidationFailed("missing_name", "Name is required.", "name")
    if len(clean_name) > MAX_NAME_LENGTH:
        raise ValidationFailed("name_too_long", "Name is too long.", "name")
    clean_email = normalize_email(email)
    clean_phone = normalize_phone(phone)
    if clean_email is None and clean_phone is None:
        raise ValidationFailed("missing_channel", "Add an email address or a phone number.", None)
    if whatsapp and clean_phone is None:
        raise ValidationFailed("whatsapp_requires_phone", "WhatsApp needs a phone number.", "phone")
    return ContactInput(name=clean_name, email=clean_email, phone=clean_phone, whatsapp=whatsapp)


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "whatsapp": bool(row["whatsapp"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_contacts(connection: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY created_at", (user_id,)
    ).fetchall()
    return [_row_to_dict(row) for row in rows]


def get_contact(connection: sqlite3.Connection, user_id: str, contact_id: str) -> dict:
    row = connection.execute(
        "SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?", (contact_id, user_id)
    ).fetchone()
    if row is None:
        raise NotFoundError("contact_not_found")
    return _row_to_dict(row)


def _ensure_unique(
    connection: sqlite3.Connection, user_id: str, contact: ContactInput, exclude_id: str | None
) -> None:
    rows = connection.execute(
        "SELECT id, email, phone FROM emergency_contacts WHERE user_id = ?", (user_id,)
    ).fetchall()
    for row in rows:
        if row["id"] == exclude_id:
            continue
        if (contact.email and row["email"] == contact.email) or (
            contact.phone and row["phone"] == contact.phone
        ):
            raise ConflictError("duplicate_contact", "This person is already an emergency contact.")


def add_contact(
    connection: sqlite3.Connection,
    user_id: str,
    contact: ContactInput,
    now: datetime,
    settings: Settings,
) -> dict:
    contact_id = new_id()
    with transaction(connection):
        count = connection.execute(
            "SELECT COUNT(*) FROM emergency_contacts WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        if count >= settings.max_contacts_per_user:
            raise ConflictError("contact_limit", "You've reached the maximum number of contacts.")
        _ensure_unique(connection, user_id, contact, None)
        connection.execute(
            """
            INSERT INTO emergency_contacts (id, user_id, name, email, phone, whatsapp, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                contact_id,
                user_id,
                contact.name,
                contact.email,
                contact.phone,
                int(contact.whatsapp),
                to_db(now),
                to_db(now),
            ),
        )
    return get_contact(connection, user_id, contact_id)


def update_contact(
    connection: sqlite3.Connection, user_id: str, contact_id: str, contact: ContactInput, now: datetime
) -> dict:
    with transaction(connection):
        _ensure_unique(connection, user_id, contact, contact_id)
        cursor = connection.execute(
            """
            UPDATE emergency_contacts
            SET name = ?, email = ?, phone = ?, whatsapp = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                contact.name,
                contact.email,
                contact.phone,
                int(contact.whatsapp),
                to_db(now),
                contact_id,
                user_id,
            ),
        )
        if cursor.rowcount != 1:
            raise NotFoundError("contact_not_found")
    return get_contact(connection, user_id, contact_id)


def delete_contact(connection: sqlite3.Connection, user_id: str, contact_id: str) -> None:
    with transaction(connection):
        cursor = connection.execute(
            "DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?", (contact_id, user_id)
        )
        if cursor.rowcount != 1:
            raise NotFoundError("contact_not_found")
