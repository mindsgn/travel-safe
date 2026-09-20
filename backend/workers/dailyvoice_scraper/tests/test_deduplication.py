from dailyvoice_scraper.cleaning.deduplication import article_duplicate_status, score_incident_pair
from dailyvoice_scraper.config import DeduplicationConfig


def test_duplicate_url() -> None:
    result = article_duplicate_status(
        canonical_url="https://dailyvoice.co.za/news/2026-09-20-example/",
        content_hash="aaa",
        normalized_title="example",
        existing=[{"canonical_url": "https://dailyvoice.co.za/news/2026-09-20-example/", "content_hash": "bbb", "normalized_title": "other"}],
        similar_title_threshold=0.92,
    )
    assert result.status == "exact_duplicate"
    assert result.reason == "canonical_url"


def test_duplicate_content() -> None:
    result = article_duplicate_status(
        canonical_url="https://dailyvoice.co.za/news/2026-09-21-copy/",
        content_hash="same-hash",
        normalized_title="copy",
        existing=[{"canonical_url": "https://dailyvoice.co.za/news/2026-09-20-orig/", "content_hash": "same-hash", "normalized_title": "orig"}],
        similar_title_threshold=0.92,
    )
    assert result.status == "exact_duplicate"
    assert result.reason == "content_hash"


def test_potential_duplicate_incident() -> None:
    match = score_incident_pair(
        {
            "id": 1,
            "incident_date": "2026-09-17",
            "suburb": "Khayelitsha",
            "crime_type": "murder",
            "victim_count": 2,
            "title": "two men shot dead in khayelitsha",
            "text": "two men were shot dead in khayelitsha on wednesday",
        },
        {
            "id": 2,
            "incident_date": "2026-09-17",
            "suburb": "Khayelitsha",
            "crime_type": "murder",
            "victim_count": 2,
            "title": "khayelitsha double murder leaves community shocked",
            "text": "a double murder in khayelitsha has left the community shocked",
        },
        DeduplicationConfig(),
    )
    assert match.score >= 0.60
    assert match.status in {"possible_duplicate", "probable_same_incident"}


def test_distinct_incidents() -> None:
    match = score_incident_pair(
        {
            "id": 1,
            "incident_date": "2026-09-08",
            "suburb": "Delft",
            "crime_type": "armed_robbery",
            "victim_count": 1,
            "title": "oupa robbed of bicycle",
            "text": "an oupa was robbed of his bicycle in delft",
        },
        {
            "id": 2,
            "incident_date": "2026-09-17",
            "suburb": "Khayelitsha",
            "crime_type": "murder",
            "victim_count": 3,
            "title": "triple murder in makhaza",
            "text": "three men were shot dead in a car in makhaza",
        },
        DeduplicationConfig(),
    )
    assert match.status == "probably_separate"
    assert match.score < 0.60
