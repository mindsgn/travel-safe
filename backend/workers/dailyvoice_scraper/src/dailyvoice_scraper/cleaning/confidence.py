"""Extraction-certainty scores, not estimates that a crime occurred."""

from __future__ import annotations


def combine_confidence(
    *,
    date_confidence: float,
    crime_type_confidence: float,
    location_confidence: float,
    has_incident: bool,
) -> float:
    """Return overall extraction certainty in [0, 1]."""
    if not has_incident:
        return round(min(crime_type_confidence, 0.4), 3)
    parts = [crime_type_confidence]
    if date_confidence > 0:
        parts.append(date_confidence)
    if location_confidence > 0:
        parts.append(location_confidence)
    return round(sum(parts) / len(parts), 3)
