"""Pure deadline rules shared by the API and the worker."""

from __future__ import annotations

from datetime import datetime, timedelta

MIN_INTERVAL_DAYS = 1
MAX_INTERVAL_DAYS = 365


def validate_interval(days: int) -> int:
    if not MIN_INTERVAL_DAYS <= days <= MAX_INTERVAL_DAYS:
        raise ValueError("interval must be between 1 and 365 days")
    return days


def compute_deadline(last_check_in: datetime, interval_days: int) -> datetime:
    return last_check_in + timedelta(days=validate_interval(interval_days))


def is_expired(deadline: datetime | None, now: datetime) -> bool:
    """Expired strictly after the deadline: a check-in exactly at the deadline is on time."""
    return deadline is not None and deadline < now


def seconds_remaining(deadline: datetime | None, now: datetime) -> int | None:
    if deadline is None:
        return None
    return int((deadline - now).total_seconds())
