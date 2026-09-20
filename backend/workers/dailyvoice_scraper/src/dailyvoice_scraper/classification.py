"""Keyword crime classification. This is not an official SAPS taxonomy."""

from __future__ import annotations

import re

from dailyvoice_scraper.models import Article, CrimeIncident

# Ordered from more specific to more general so the first match wins.
CRIME_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("armed_robbery", (r"armed robber", r"robbed at gunpoint", r"gunpoint robbery")),
    ("hijacking", (r"hijack", r"hijacking")),
    ("vehicle_theft", (r"stolen vehicle", r"vehicle theft", r"car theft", r"stolen car")),
    ("robbery", (r"\brobber", r"\brobbed\b", r"\brobbery\b")),
    ("burglary", (r"burglar", r"housebreak", r"break[- ]in")),
    ("attempted_murder", (r"attempted murder", r"tried to kill")),
    ("murder", (r"\bmurder", r"shot dead", r"gunned down", r"killed", r"homicide", r"fatal shooting")),
    ("kidnapping", (r"kidnap", r"abduct")),
    ("rape", (r"\brape", r"\braped\b")),
    ("sexual_offence", (r"sexual offence", r"sexual assault", r"indecent assault")),
    ("assault", (r"\bassault", r"\bbeaten\b", r"\bstabb")),
    ("firearm_offence", (r"firearm", r"illegal gun", r"unlicensed firearm")),
    ("drug_offence", (r"\bdrug", r"\bmandrax\b", r"\btik\b", r"\bdagga\b", r"narcotic")),
    ("fraud", (r"\bfraud", r"scam", r"embezzle")),
    ("corruption", (r"corrupt", r"bribe")),
    ("arson", (r"\barson\b", r"set alight", r"deliberate fire")),
    ("theft", (r"\btheft\b", r"\bstolen\b", r"\bsteal")),
    ("missing_person", (r"missing person", r"reported missing", r"vanished")),
    ("arrest", (r"\barrest", r"\bvas\b", r"taken into custody")),
    ("court_case", (r"\bcourt\b", r"\bconvicted\b", r"\bsentenced\b", r"\bindictment\b")),
]


_COUNT_PATTERNS = {
    "victim": re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.{0,20}\b(victim|killed|shot dead|wounded)\b",
        re.I,
    ),
    "suspect": re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.{0,20}\b(suspect|arrested|gunmen|assailants)\b",
        re.I,
    ),
}

_NUMBERS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}

INCIDENT_CUES = re.compile(
    r"(occurred in|took place in|shot dead (?:in|at)|killed (?:in|at)|robbed (?:in|at)|"
    r"murder(?:ed)? (?:in|at)|stabbed (?:in|at)|found (?:in|at))",
    re.I,
)


def classify_crime(title: str, body: str) -> tuple[str | None, float]:
    """Return (crime_type, confidence) from conservative keyword matching."""
    haystack = f"{title}\n{body}".lower()
    for crime_type, patterns in CRIME_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, haystack, flags=re.I):
                confidence = 0.8 if crime_type not in {"arrest", "court_case", "other"} else 0.45
                return crime_type, confidence
    return None, 0.0


def extract_counts(text: str) -> tuple[int | None, int | None]:
    victim = _first_count(_COUNT_PATTERNS["victim"].search(text))
    suspect = _first_count(_COUNT_PATTERNS["suspect"].search(text))
    return victim, suspect


def _first_count(match: re.Match[str] | None) -> int | None:
    if not match:
        return None
    token = match.group(1).lower()
    if token.isdigit():
        return int(token)
    return _NUMBERS.get(token)


def maybe_incident(article: Article, location: str | None) -> CrimeIncident | None:
    """Create an incident row only when crime language is present.

    One news article is not automatically one unique crime incident.
    """
    crime_type, confidence = classify_crime(article.title, article.article_text)
    if not crime_type:
        return None
    combined = f"{article.title}\n{article.article_text}"
    victims, suspects = extract_counts(combined)
    incident_location = location if location and INCIDENT_CUES.search(combined) else None
    return CrimeIncident(
        article_id=article.id,
        crime_type=crime_type,
        location=incident_location,
        incident_date=None,
        victim_count=victims,
        suspect_count=suspects,
        extraction_confidence=round(min(confidence, 0.7 if incident_location else 0.4), 2),
        crime_type_confidence=confidence,
    )
