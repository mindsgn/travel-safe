from dailyvoice_scraper.cleaning.dates import extract_incident_date


def test_extract_explicit_incident_date() -> None:
    result = extract_incident_date(
        "The robbery happened on 8 September at around 5am.",
        "2026-09-20T13:10:00+00:00",
    )
    assert result.incident_date == "2026-09-08"
    assert result.confidence > 0


def test_extract_relative_date() -> None:
    result = extract_incident_date(
        "The shooting happened on Thursday afternoon.",
        "2026-09-20T12:45:00+00:00",
    )
    assert result.incident_date == "2026-09-17"
    assert result.rule == "relative_weekday"


def test_distinguish_publication_date_from_incident_date() -> None:
    result = extract_incident_date(
        "The incident happened on Friday. This story was published later.",
        "2026-09-20T14:30:00+00:00",
    )
    assert result.incident_date != "2026-09-20"
    assert result.incident_date == "2026-09-18"


def test_unknown_incident_date() -> None:
    result = extract_incident_date(
        "Police are still investigating the matter.",
        "2026-09-20T14:30:00+00:00",
    )
    assert result.incident_date is None
    assert result.confidence == 0
