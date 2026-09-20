"""Date parsing with explicit timezone handling for South Africa."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from dateutil import parser as date_parser

SAST = ZoneInfo("Africa/Johannesburg")


def normalize_datetime(value: str | int | float | None) -> tuple[str | None, str | None]:
    """Return (iso8601, original_string).

    Ambiguous day-first vs month-first numeric dates are rejected rather than guessed.
    Unix timestamps (seconds or milliseconds) are interpreted as UTC then converted
    to Africa/Johannesburg when no offset is present.
    """
    if value is None:
        return None, None
    raw = str(value).strip()
    if not raw:
        return None, None

    if raw.isdigit():
        iso = _from_unix(raw)
        return iso, raw

    try:
        parsed = date_parser.parse(raw, fuzzy=False, dayfirst=False, yearfirst=True)
    except (ValueError, OverflowError, TypeError):
        return None, raw

    if parsed.tzinfo is None:
        # Daily Voice JSON-LD uses +0000. Bare local clock times on the site are SAST.
        if _looks_like_utc_zulu(raw):
            parsed = parsed.replace(tzinfo=UTC)
        else:
            parsed = parsed.replace(tzinfo=SAST)
    return parsed.isoformat(), raw


def _looks_like_utc_zulu(raw: str) -> bool:
    lowered = raw.lower()
    return lowered.endswith("z") or "+0000" in raw or "+00:00" in raw


def _from_unix(raw: str) -> str | None:
    try:
        number = int(raw)
    except ValueError:
        return None
    if number > 10_000_000_000:
        number = number / 1000
    try:
        return datetime.fromtimestamp(number, tz=UTC).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def utc_now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()
