"""Location extraction with role disambiguation. No geocoding API."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from dailyvoice_scraper.cleaning.geography import PLACES
from dailyvoice_scraper.cleaning.location_aliases import LOCATION_ALIASES

ROLE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "incident",
        re.compile(
            r"(?:occurred|took place|happened|committed|shot(?: dead)?|killed|murdered|"
            r"robbed|stabbed|found|attacked|assaulted|kidnapped|opened fire)"
            r".{0,40}(?:in|at|near)\s+(?:the\s+)?(?P<place>[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,3})",
            re.I,
        ),
    ),
    (
        "court",
        re.compile(
            r"(?P<place>[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,2})\s+"
            r"(?:magistrate(?:’s|s)? court|high court|court)",
            re.I,
        ),
    ),
    (
        "arrest",
        re.compile(
            r"(?:arrested|re-arrested|taken into custody).{0,40}(?:in|at)\s+(?:the\s+)?"
            r"(?P<place>[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,3})",
            re.I,
        ),
    ),
    (
        "police_station",
        re.compile(
            r"(?P<place>[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,3})\s+police station",
            re.I,
        ),
    ),
    (
        "residence",
        re.compile(
            r"(?:from|resident of|lives in)\s+(?:the\s+)?"
            r"(?P<place>[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,3})",
            re.I,
        ),
    ),
]


@dataclass
class ExtractedLocation:
    role: str
    original_text: str
    normalized_name: str | None
    province: str | None = None
    municipality: str | None = None
    city: str | None = None
    suburb: str | None = None
    precision: str | None = None
    confidence: float = 0.0


@dataclass
class LocationExtraction:
    incident: ExtractedLocation | None
    candidates: list[ExtractedLocation] = field(default_factory=list)
    ambiguous: bool = False


def apply_alias(raw: str) -> str:
    key = re.sub(r"\s+", " ", raw.strip().lower().replace("’", "'"))
    if key in LOCATION_ALIASES:
        return LOCATION_ALIASES[key]
    for alias, canonical in LOCATION_ALIASES.items():
        if alias in key:
            return canonical
    return raw.strip()


def lookup_place(name: str) -> dict[str, str] | None:
    key = apply_alias(name).lower().replace("’", "'")
    if key in PLACES:
        return PLACES[key]
    for place_key, meta in PLACES.items():
        if place_key == key or key.startswith(place_key + " ") or place_key.startswith(key + " "):
            return meta
    return None


def extract_locations(text: str) -> LocationExtraction:
    candidates: list[ExtractedLocation] = []
    seen: set[tuple[str, str]] = set()
    for role, pattern in ROLE_PATTERNS:
        for match in pattern.finditer(text):
            original = match.group("place").strip()
            if len(original) < 3:
                continue
            key = (role, original.lower())
            if key in seen:
                continue
            seen.add(key)
            candidates.append(_build_location(role, original))

    incident_candidates = [item for item in candidates if item.role == "incident" and item.normalized_name]
    if len(incident_candidates) == 1:
        chosen = incident_candidates[0]
        chosen.confidence = max(chosen.confidence, 0.8)
        return LocationExtraction(incident=chosen, candidates=candidates, ambiguous=False)
    if len(incident_candidates) > 1:
        unique_names = {item.normalized_name for item in incident_candidates}
        if len(unique_names) == 1:
            chosen = incident_candidates[0]
            chosen.confidence = 0.75
            return LocationExtraction(incident=chosen, candidates=candidates, ambiguous=False)
        return LocationExtraction(incident=None, candidates=candidates, ambiguous=True)

    known = [item for item in candidates if item.normalized_name and item.role not in {"court", "residence"}]
    if len(known) == 1:
        chosen = known[0]
        chosen.confidence = min(chosen.confidence, 0.45)
        return LocationExtraction(incident=chosen, candidates=candidates, ambiguous=True)
    if len({item.normalized_name for item in known}) > 1:
        return LocationExtraction(incident=None, candidates=candidates, ambiguous=True)
    return LocationExtraction(incident=None, candidates=candidates, ambiguous=bool(candidates))


def _build_location(role: str, original: str) -> ExtractedLocation:
    aliased = apply_alias(original)
    meta = lookup_place(aliased)
    if not meta:
        return ExtractedLocation(role=role, original_text=original, normalized_name=None, confidence=0.2)
    suburb = meta.get("suburb") or None
    city = meta.get("city") or None
    return ExtractedLocation(
        role=role,
        original_text=original,
        normalized_name=suburb or city or meta.get("province"),
        province=meta.get("province") or None,
        municipality=meta.get("municipality") or None,
        city=city,
        suburb=suburb,
        precision=meta.get("precision") or None,
        confidence=0.85 if role == "incident" else 0.4,
    )
