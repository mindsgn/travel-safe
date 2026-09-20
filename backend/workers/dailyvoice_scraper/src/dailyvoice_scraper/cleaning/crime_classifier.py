"""Controlled crime vocabulary. These labels are not official SAPS categories."""

from __future__ import annotations

import re
from dataclasses import dataclass

CRIME_TYPES = (
    "murder",
    "attempted_murder",
    "assault",
    "robbery",
    "armed_robbery",
    "burglary",
    "theft",
    "vehicle_theft",
    "hijacking",
    "kidnapping",
    "rape",
    "sexual_offence",
    "drug_offence",
    "firearm_offence",
    "fraud",
    "corruption",
    "arson",
    "missing_person",
    "arrest",
    "court_case",
    "other",
)

# More specific patterns first.
PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("armed_robbery", (r"armed robber", r"robbed at gunpoint", r"gunpoint robbery", r"gunmen rob")),
    ("hijacking", (r"\bhijack", r"hijacking")),
    ("vehicle_theft", (r"stolen vehicle", r"vehicle theft", r"car theft", r"stolen car")),
    ("robbery", (r"\brobber", r"\brobbed\b", r"\brobbery\b")),
    ("burglary", (r"burglar", r"housebreak", r"break[- ]in")),
    ("attempted_murder", (r"attempted murder", r"tried to kill")),
    ("murder", (r"\bmurder", r"shot dead", r"gunned down", r"\bkilled\b", r"homicide", r"fatal shooting", r"double murder", r"triple murder")),
    ("kidnapping", (r"kidnap", r"abduct")),
    ("rape", (r"\brape", r"\braped\b")),
    ("sexual_offence", (r"sexual offence", r"sexual assault", r"indecent assault")),
    ("assault", (r"\bassault", r"\bbeaten\b", r"\bstabb")),
    ("firearm_offence", (r"illegal firearm", r"unlicensed firearm", r"illegal gun")),
    ("drug_offence", (r"\bmandrax\b", r"\btik\b", r"\bdagga\b", r"drug stash", r"narcotic")),
    ("fraud", (r"\bfraud", r"embezzle")),
    ("corruption", (r"\bcorrupt", r"\bbribe")),
    ("arson", (r"\barson\b", r"set alight")),
    ("theft", (r"\btheft\b", r"\bstolen\b")),
    ("missing_person", (r"missing person", r"reported missing", r"went missing", r"vanished")),
    ("arrest", (r"\barrest", r"taken into custody")),
    ("court_case", (r"\bcourt\b", r"\bconvicted\b", r"\bsentenced\b", r"\bindictment\b")),
]

HISTORICAL_REFERENCE = re.compile(
    r"(wanted for (?:a )?murder|investigating a murder arrest|convicted of .{0,60}murder|"
    r"appeal.{0,40}murder|sentenced.{0,40}(?:for|of) .{0,40}murder|murder trial|"
    r"accused of murdering|re-arrested.{0,40}murder)",
    re.I,
)

INCIDENT_REPORTING = re.compile(
    r"(shot dead|gunned down|was robbed|were robbed|was kidnapped|was murdered|"
    r"were shot|opened fire|fatal shooting|body was found|bodies were found|"
    r"the incident (?:happened|occurred|took place)|killed in|murdered in)",
    re.I,
)

_COUNT_PATTERNS = {
    "victim": re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.{0,24}"
        r"\b(victim|killed|shot dead|wounded|men were shot)\b",
        re.I,
    ),
    "suspect": re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.{0,24}"
        r"\b(suspect|arrested|gunmen|assailants)\b",
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


@dataclass(frozen=True)
class CrimeClassification:
    crime_type: str | None
    confidence: float
    matched_terms: list[str]
    original: str | None
    is_reported_incident: bool
    reason: str


def classify_crime(title: str, body: str) -> CrimeClassification:
    haystack = f"{title}\n{body}"
    lowered = haystack.lower()
    historical = bool(HISTORICAL_REFERENCE.search(haystack))
    reported = bool(INCIDENT_REPORTING.search(haystack))

    for crime_type, patterns in PATTERNS:
        matched: list[str] = []
        for pattern in patterns:
            found = re.search(pattern, haystack, flags=re.I)
            if found:
                matched.append(found.group(0).lower())
        if not matched:
            continue
        if crime_type == "murder" and historical and not reported:
            continue
        is_incident = reported or crime_type not in {"court_case", "arrest"}
        if historical and crime_type == "murder":
            is_incident = reported
        confidence = 0.9 if len(matched) > 1 else 0.8
        if crime_type in {"arrest", "court_case"}:
            confidence = 0.45
            is_incident = crime_type == "arrest" and "arrest" in lowered
        return CrimeClassification(
            crime_type=crime_type,
            confidence=confidence,
            matched_terms=matched,
            original=matched[0],
            is_reported_incident=is_incident,
            reason=f"matched:{','.join(matched)}",
        )

    if historical and not reported:
        return CrimeClassification(
            crime_type=None,
            confidence=0.0,
            matched_terms=[],
            original=None,
            is_reported_incident=False,
            reason="historical_reference_only",
        )
    return CrimeClassification(
        crime_type=None,
        confidence=0.0,
        matched_terms=[],
        original=None,
        is_reported_incident=False,
        reason="no_crime_terms",
    )


def extract_counts(text: str) -> tuple[int | None, int | None]:
    victim = _parse_count(_COUNT_PATTERNS["victim"].search(text))
    suspect = _parse_count(_COUNT_PATTERNS["suspect"].search(text))
    return victim, suspect


def _parse_count(match: re.Match[str] | None) -> int | None:
    if not match:
        return None
    token = match.group(1).lower()
    if token.isdigit():
        value = int(token)
        return value if value >= 0 else None
    return _NUMBERS.get(token)
