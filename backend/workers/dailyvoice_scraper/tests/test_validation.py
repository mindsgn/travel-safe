from dailyvoice_scraper.cleaning.validation import validate_incident
from dailyvoice_scraper.config import ValidationSettings


def test_invalid_coordinates() -> None:
    issues = validate_incident(
        incident_date="2026-09-01",
        published_at="2026-09-20",
        crime_type="murder",
        province="Western Cape",
        latitude=120.0,
        longitude=-200.0,
        victim_count=1,
        suspect_count=0,
        settings=ValidationSettings(),
    )
    fields = {issue.field for issue in issues}
    assert "latitude" in fields
    assert "longitude" in fields


def test_invalid_date() -> None:
    issues = validate_incident(
        incident_date="2099-01-01",
        published_at="2026-09-20",
        crime_type="robbery",
        province="Western Cape",
        latitude=None,
        longitude=None,
        victim_count=None,
        suspect_count=None,
        settings=ValidationSettings(allow_future_dates=False),
    )
    assert any(issue.field == "incident_date" for issue in issues)


def test_invalid_crime_type() -> None:
    issues = validate_incident(
        incident_date="2026-09-01",
        published_at="2026-09-20",
        crime_type="not_a_real_type",
        province="Western Cape",
        latitude=None,
        longitude=None,
        victim_count=None,
        suspect_count=None,
        settings=ValidationSettings(),
    )
    assert any(issue.field == "crime_type" for issue in issues)


def test_invalid_counts() -> None:
    issues = validate_incident(
        incident_date="2026-09-01",
        published_at="2026-09-20",
        crime_type="assault",
        province="Western Cape",
        latitude=None,
        longitude=None,
        victim_count=-1,
        suspect_count=-3,
        settings=ValidationSettings(),
    )
    fields = {issue.field for issue in issues}
    assert "victim_count" in fields
    assert "suspect_count" in fields
