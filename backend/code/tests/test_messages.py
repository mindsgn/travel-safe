from datetime import timedelta

from deadman.notifications.messages import (
    EmergencyMessage,
    email_html,
    email_subject,
    email_text,
    short_text,
)
from deadman.timeutil import format_human
from tests.conftest import START


def _message(**overrides) -> EmergencyMessage:
    values = {
        "user_name": "Thandi",
        "contact_name": "Sipho",
        "last_check_in_at": START,
        "deadline_at": START + timedelta(days=1),
        "link_url": "https://safe.example/e/token",
        "link_expires_at": START + timedelta(days=31),
        "timezone": "Africa/Johannesburg",
        "address": "12 Long Street, Cape Town",
        "latitude": -33.92,
        "longitude": 18.42,
        "location_recorded_at": START,
    }
    values.update(overrides)
    return EmergencyMessage(**values)


def test_email_explains_known_and_unknown():
    text = email_text(_message())
    assert email_subject(_message()) == "Thandi missed a scheduled safety check-in"
    assert "What we know:" in text
    assert "What we don't know:" in text
    assert "doesn't necessarily mean something is wrong" in text
    assert "12 Long Street, Cape Town" in text
    assert "https://safe.example/e/token" in text
    assert "SAST" in text


def test_email_without_location_says_so():
    text = email_text(_message(latitude=None, longitude=None, address=None))
    assert "No location was shared" in text


def test_email_html_escapes_user_content():
    html = email_html(_message(user_name="<b>Eve</b>"))
    assert "<b>Eve</b>" not in html
    assert "&lt;b&gt;Eve&lt;/b&gt;" in html


def test_short_text_is_concise_and_includes_link():
    text = short_text(_message())
    assert text.startswith("Travel Safe: Thandi missed")
    assert text.endswith("https://safe.example/e/token")
    assert len(text) < 320


def test_format_human_falls_back_to_utc():
    assert format_human(START, "Not/AZone").endswith("UTC")
    assert format_human(None) == "unknown"
