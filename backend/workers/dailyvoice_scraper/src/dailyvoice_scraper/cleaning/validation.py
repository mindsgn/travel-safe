"""Record validation. Failures are reported, not silently discarded."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from dailyvoice_scraper.cleaning.crime_classifier import CRIME_TYPES
from dailyvoice_scraper.cleaning.geography import is_valid_province
from dailyvoice_scraper.config import ValidationSettings


@dataclass(frozen=True)
class ValidationIssue:
    field: str
    message: str


def validate_incident(
    *,
    incident_date: str | None,
    published_at: str | None,
    crime_type: str | None,
    province: str | None,
    latitude: float | None,
    longitude: float | None,
    victim_count: int | None,
    suspect_count: int | None,
    settings: ValidationSettings,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    today = datetime.now().date()
    parsed_incident = _parse_date(incident_date)
    parsed_published = _parse_date(published_at)

    if parsed_incident and not settings.allow_future_dates and parsed_incident > today:
        issues.append(ValidationIssue("incident_date", "incident_date is in the future"))
    if parsed_incident and parsed_published and parsed_incident > parsed_published:
        issues.append(ValidationIssue("incident_date", "incident_date is after publication date"))
    if parsed_incident and parsed_published:
        max_age = timedelta(days=settings.max_incident_age_days)
        if parsed_published - parsed_incident > max_age:
            issues.append(ValidationIssue("incident_date", "incident_date is much older than publication date"))

    if latitude is not None and not -90 <= latitude <= 90:
        issues.append(ValidationIssue("latitude", "latitude out of range"))
    if longitude is not None and not -180 <= longitude <= 180:
        issues.append(ValidationIssue("longitude", "longitude out of range"))
    if victim_count is not None and victim_count < 0:
        issues.append(ValidationIssue("victim_count", "victim_count must be >= 0"))
    if suspect_count is not None and suspect_count < 0:
        issues.append(ValidationIssue("suspect_count", "suspect_count must be >= 0"))
    if crime_type is not None and crime_type not in CRIME_TYPES:
        issues.append(ValidationIssue("crime_type", "crime_type is not in the controlled vocabulary"))
    if province is not None and not is_valid_province(province):
        issues.append(ValidationIssue("province", "province is not a recognised South African province"))
    return issues


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
