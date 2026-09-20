from travel_safe.crime import PRECINCTS, max_reported_crimes


def test_precincts_and_peak_crimes():
    assert len(PRECINCTS) >= 8
    assert max_reported_crimes() == max(item.reported_crimes for item in PRECINCTS)
