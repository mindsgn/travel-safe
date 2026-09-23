from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = UTC

# Fixed-width UTC format so timestamps sort lexically in SQLite and parse cleanly as
# TIMESTAMPTZ if the schema is moved to PostgreSQL.
DB_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("naive datetimes are not allowed; supply a timezone")
    return value.astimezone(UTC)


def to_db(value: datetime) -> str:
    return ensure_utc(value).strftime(DB_FORMAT)


def from_db(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.strptime(value, DB_FORMAT).replace(tzinfo=UTC)


def resolve_zone(name: str | None) -> ZoneInfo | timezone:
    if not name:
        return UTC
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return UTC


def format_human(value: datetime | None, zone_name: str | None = None) -> str:
    if value is None:
        return "unknown"
    local = ensure_utc(value).astimezone(resolve_zone(zone_name))
    label = local.tzname() or "UTC"
    return f"{local.strftime('%a %d %b %Y, %H:%M')} {label}"
