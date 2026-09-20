"""Conservative location extraction for Western Cape news copy."""

from __future__ import annotations

import re

# Places are matched as whole words. Passing mentions are not enough for incident location.
KNOWN_PLACES: dict[str, dict[str, str]] = {
    "khayelitsha": {"suburb": "Khayelitsha", "city": "Cape Town", "province": "Western Cape"},
    "delft": {"suburb": "Delft", "city": "Cape Town", "province": "Western Cape"},
    "bonteheuwel": {"suburb": "Bonteheuwel", "city": "Cape Town", "province": "Western Cape"},
    "mitchells plain": {"suburb": "Mitchells Plain", "city": "Cape Town", "province": "Western Cape"},
    "mitchell's plain": {"suburb": "Mitchells Plain", "city": "Cape Town", "province": "Western Cape"},
    "paarl": {"suburb": "Paarl", "city": "Paarl", "province": "Western Cape"},
    "stellenbosch": {"suburb": "Stellenbosch", "city": "Stellenbosch", "province": "Western Cape"},
    "klapmuts": {"suburb": "Klapmuts", "city": "Stellenbosch", "province": "Western Cape"},
    "plumstead": {"suburb": "Plumstead", "city": "Cape Town", "province": "Western Cape"},
    "philippi": {"suburb": "Philippi", "city": "Cape Town", "province": "Western Cape"},
    "nyanga": {"suburb": "Nyanga", "city": "Cape Town", "province": "Western Cape"},
    "gugulethu": {"suburb": "Gugulethu", "city": "Cape Town", "province": "Western Cape"},
    "athlone": {"suburb": "Athlone", "city": "Cape Town", "province": "Western Cape"},
    "bellville": {"suburb": "Bellville", "city": "Cape Town", "province": "Western Cape"},
    "kraaifontein": {"suburb": "Kraaifontein", "city": "Cape Town", "province": "Western Cape"},
    "elsies river": {"suburb": "Elsies River", "city": "Cape Town", "province": "Western Cape"},
    "lavender hill": {"suburb": "Lavender Hill", "city": "Cape Town", "province": "Western Cape"},
    "cape town": {"suburb": "", "city": "Cape Town", "province": "Western Cape"},
    "western cape": {"suburb": "", "city": "", "province": "Western Cape"},
}

INCIDENT_LOCATION_RE = re.compile(
    r"(?:occurred|took place|shot(?: dead)?|killed|murdered|robbed|stabbed|found|"
    r"attacked|assaulted)\s+(?:in|at|near)\s+(?:the\s+)?(?P<place>[A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})",
    re.I,
)

POLICE_STATION_RE = re.compile(
    r"(?P<station>[A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){0,3})\s+police station",
    re.I,
)


def extract_location(text: str) -> dict[str, str | None]:
    """Return structured location fields, or all None when the incident place is unclear.

    Distinguishes 'arrested in Cape Town' (not used as incident location) from
    'The murder occurred in Khayelitsha'.
    """
    empty = {
        "location": None,
        "province": None,
        "city": None,
        "suburb": None,
        "police_station": None,
    }
    if not text:
        return empty

    station_match = POLICE_STATION_RE.search(text)
    police_station = station_match.group("station").strip() if station_match else None

    incident_match = INCIDENT_LOCATION_RE.search(text)
    if not incident_match:
        return {**empty, "police_station": police_station}

    candidate = incident_match.group("place").strip()
    known = _lookup_place(candidate)
    if not known:
        # Do not invent a place from an unmatched proper noun.
        return {**empty, "police_station": police_station}

    location_parts = [known.get("suburb") or known.get("city") or known.get("province")]
    location = next((part for part in location_parts if part), None)
    return {
        "location": location,
        "province": known.get("province") or None,
        "city": known.get("city") or None,
        "suburb": known.get("suburb") or None,
        "police_station": police_station,
    }


def _lookup_place(name: str) -> dict[str, str] | None:
    key = name.lower().replace("’", "'").strip()
    if key in KNOWN_PLACES:
        return KNOWN_PLACES[key]
    for place_name, meta in KNOWN_PLACES.items():
        if place_name in key or key in place_name:
            return meta
    return None
