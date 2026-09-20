from dailyvoice_scraper.cleaning.text import normalize_text, normalize_title, normalize_unicode, strip_html_artifacts


def test_normalize_whitespace() -> None:
    assert normalize_text("Police   arrested   the suspect.\n\n") == "Police arrested the suspect."


def test_normalize_unicode() -> None:
    # NFKC compatibility: fullwidth letters collapse to ASCII.
    assert "Police" in normalize_unicode("Ｐolice")


def test_remove_html_artifacts() -> None:
    cleaned = normalize_text("Police arrested the <b>suspect</b>&nbsp;today.")
    assert "<b>" not in cleaned
    assert "suspect" in cleaned
    assert "  " not in cleaned


def test_normalize_title() -> None:
    assert normalize_title("Man arrested after Khayelitsha shooting!") == (
        "man arrested after khayelitsha shooting"
    )
