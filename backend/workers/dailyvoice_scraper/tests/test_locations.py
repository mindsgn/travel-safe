from dailyvoice_scraper.cleaning.locations import apply_alias, extract_locations


def test_extract_khayelitsha() -> None:
    result = extract_locations("The murder occurred in Khayelitsha on Tuesday evening.")
    assert result.incident is not None
    assert result.incident.suburb == "Khayelitsha"
    assert result.incident.city == "Cape Town"


def test_extract_multiple_locations() -> None:
    result = extract_locations(
        "A suspect from Khayelitsha appeared in a Cape Town court for a murder committed in Nyanga."
    )
    roles = {item.role for item in result.candidates}
    assert "residence" in roles or "court" in roles
    assert any(item.normalized_name == "Nyanga" for item in result.candidates)


def test_identify_incident_location() -> None:
    result = extract_locations(
        "A suspect from Khayelitsha appeared in a Cape Town court for a murder committed in Nyanga."
    )
    assert result.incident is not None
    assert result.incident.suburb == "Nyanga"


def test_ambiguous_location() -> None:
    result = extract_locations(
        "Police mentioned Delft, Bellville and Parow while appealing for information."
    )
    assert result.incident is None or result.ambiguous is True


def test_location_alias() -> None:
    assert apply_alias("the Khayelitsha area") == "Khayelitsha"
    result = extract_locations("The shooting occurred in the Khayelitsha area.")
    assert result.incident is not None
    assert result.incident.suburb == "Khayelitsha"
