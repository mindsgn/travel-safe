from dailyvoice_scraper.cleaning.crime_classifier import classify_crime


def test_murder_classification() -> None:
    result = classify_crime(
        "Man shot dead in Nyanga",
        "A 23-year-old man was shot dead outside a shop in Nyanga on Thursday.",
    )
    assert result.crime_type == "murder"
    assert result.is_reported_incident is True
    assert "shot dead" in result.matched_terms


def test_robbery_classification() -> None:
    result = classify_crime(
        "Good Samaritan gifts robbed oupa new bike",
        "A senior was robbed at gunpoint of his bike and bag in Delft.",
    )
    assert result.crime_type == "armed_robbery"


def test_hijacking_classification() -> None:
    result = classify_crime("Airport hijacking", "Two suspects hijacked a vehicle near the airport.")
    assert result.crime_type == "hijacking"


def test_firearm_classification() -> None:
    result = classify_crime(
        "Man arrested with illegal firearm",
        "Police arrested a man after finding an illegal firearm in his bag.",
    )
    assert result.crime_type == "firearm_offence"


def test_unknown_crime() -> None:
    result = classify_crime(
        "Golden Arrow cash fares on hike",
        "Commuters will pay more for selected Golden Arrow cash fares from 28 September.",
    )
    assert result.crime_type is None
    assert result.is_reported_incident is False


def test_historical_murder_reference() -> None:
    result = classify_crime(
        "Suspect appears in court",
        "Police arrested a man wanted for murder. He appeared in the Blue Downs Magistrate's Court.",
    )
    assert result.crime_type != "murder"
    assert result.is_reported_incident is False or result.crime_type == "arrest"
