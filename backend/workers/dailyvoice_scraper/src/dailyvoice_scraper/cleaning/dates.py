"""Incident-date extraction. Publication date is never treated as the incident date."""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

MONTHS = {
    name.lower(): index
    for index, name in enumerate(calendar.month_name)
    if name
} | {
    name.lower(): index
    for index, name in enumerate(calendar.month_abbr)
    if name
}

WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

EXPLICIT_DATE_RE = re.compile(
    r"\b(?:on\s+)?(?P<day>\d{1,2})(?:st|nd|rd|th)?\s+"
    r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
    r"(?:\s+(?P<year>\d{4}))?\b",
    re.I,
)

ISO_DATE_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
WEEKDAY_RE = re.compile(
    r"\bon\s+(?P<weekday>Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b",
    re.I,
)


@dataclass(frozen=True)
class IncidentDateResult:
    incident_date: str | None
    confidence: float
    original: str | None
    rule: str | None


def parse_published_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.date()


def extract_incident_date(text: str, published_at: str | None) -> IncidentDateResult:
    """Extract a calendar incident date from copy. Returns NULL when unsure."""
    published = parse_published_date(published_at)
    iso = ISO_DATE_RE.search(text)
    if iso:
        found = iso.group(1)
        if published and found == published.isoformat():
            return IncidentDateResult(None, 0.0, found, "ignored_publication_date_in_body")
        return IncidentDateResult(found, 0.9, found, "explicit_iso_date")

    explicit = EXPLICIT_DATE_RE.search(text)
    if explicit:
        day = int(explicit.group("day"))
        month_token = explicit.group("month").lower()
        if month_token == "sept":
            month_token = "sep"
        month = MONTHS[month_token]
        year = int(explicit.group("year")) if explicit.group("year") else (published.year if published else None)
        if year is None:
            return IncidentDateResult(None, 0.0, explicit.group(0), "explicit_date_missing_year")
        try:
            resolved = date(year, month, day)
        except ValueError:
            return IncidentDateResult(None, 0.0, explicit.group(0), "invalid_calendar_date")
        if published and resolved > published:
            # Day-month without year that lands after publication is last year.
            if not explicit.group("year"):
                try:
                    resolved = date(year - 1, month, day)
                except ValueError:
                    return IncidentDateResult(None, 0.0, explicit.group(0), "invalid_calendar_date")
            else:
                return IncidentDateResult(None, 0.0, explicit.group(0), "incident_date_after_publication")
        return IncidentDateResult(resolved.isoformat(), 0.85, explicit.group(0), "explicit_day_month")

    weekday = WEEKDAY_RE.search(text)
    if weekday and published:
        target = WEEKDAYS[weekday.group("weekday").lower()]
        resolved = _most_recent_weekday(published, target)
        return IncidentDateResult(
            resolved.isoformat(),
            0.55,
            weekday.group(0),
            "relative_weekday",
        )
    return IncidentDateResult(None, 0.0, None, None)


def _most_recent_weekday(published: date, weekday: int) -> date:
    delta = (published.weekday() - weekday) % 7
    return published - timedelta(days=delta)
