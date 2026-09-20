"""Article-level and incident-level duplicate detection. No silent merges."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from dailyvoice_scraper.config import DeduplicationConfig


@dataclass(frozen=True)
class ArticleDuplicateResult:
    status: str
    reason: str


@dataclass(frozen=True)
class IncidentMatch:
    other_id: int
    score: float
    status: str
    reason: str


def similar_ratio(left: str | None, right: str | None) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(a=left.lower(), b=right.lower()).ratio()


def article_duplicate_status(
    *,
    canonical_url: str | None,
    content_hash: str | None,
    normalized_title: str | None,
    existing: list[dict[str, str | None]],
    similar_title_threshold: float,
) -> ArticleDuplicateResult:
    for row in existing:
        if canonical_url and row.get("canonical_url") == canonical_url:
            return ArticleDuplicateResult("exact_duplicate", "canonical_url")
        if content_hash and row.get("content_hash") == content_hash:
            return ArticleDuplicateResult("exact_duplicate", "content_hash")
        if similar_ratio(normalized_title, row.get("normalized_title")) >= similar_title_threshold:
            return ArticleDuplicateResult("potential_duplicate", "similar_title")
    return ArticleDuplicateResult("unique", "no_match")


def score_incident_pair(
    left: dict[str, object],
    right: dict[str, object],
    config: DeduplicationConfig,
) -> IncidentMatch:
    weights = config.weights
    score = 0.0
    reasons: list[str] = []
    if left.get("incident_date") and left.get("incident_date") == right.get("incident_date"):
        score += weights.same_incident_date
        reasons.append("same_incident_date")
    left_place = left.get("suburb") or left.get("location_text")
    right_place = right.get("suburb") or right.get("location_text")
    if left_place and left_place == right_place:
        score += weights.same_suburb
        reasons.append("same_suburb")
    if left.get("crime_type") and left.get("crime_type") == right.get("crime_type"):
        score += weights.same_crime_type
        reasons.append("same_crime_type")
    if _similar_count(left.get("victim_count"), right.get("victim_count")):
        score += weights.similar_victim_count
        reasons.append("similar_victim_count")
    title_ratio = similar_ratio(str(left.get("title") or ""), str(right.get("title") or ""))
    if title_ratio >= 0.6:
        score += weights.similar_title * title_ratio
        reasons.append(f"similar_title:{title_ratio:.2f}")
    text_ratio = similar_ratio(str(left.get("text") or "")[:500], str(right.get("text") or "")[:500])
    if text_ratio >= 0.5:
        score += weights.similar_text * text_ratio
        reasons.append(f"similar_text:{text_ratio:.2f}")
    score = round(min(score, 1.0), 3)
    if score >= config.probable_duplicate_threshold:
        status = "probable_same_incident"
    elif score >= config.possible_duplicate_threshold:
        status = "possible_duplicate"
    else:
        status = "probably_separate"
    return IncidentMatch(
        other_id=int(right["id"]),
        score=score,
        status=status,
        reason=";".join(reasons) if reasons else "no_shared_features",
    )


def _similar_count(left: object, right: object) -> bool:
    if left is None or right is None:
        return False
    try:
        return abs(int(left) - int(right)) <= 1
    except (TypeError, ValueError):
        return False
