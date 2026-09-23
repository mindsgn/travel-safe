import json
from urllib.parse import parse_qs

import httpx

from deadman.config import Settings
from deadman.geocoding import MapboxGeocoder
from deadman.notifications.providers import (
    ResendEmailProvider,
    TwilioMessagingProvider,
    UnconfiguredEmailProvider,
    UnconfiguredMessagingProvider,
)
from deadman.services import build_email_provider, build_geocoder, build_messaging_provider


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_resend_sends_expected_request():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json={"id": "re_123"})

    provider = ResendEmailProvider("re_key", "Deadman Switch <alerts@example.com>", client=_client(handler))
    result = provider.send_email(to="a@example.com", subject="S", text="T", html="<p>H</p>", idempotency_key="n1-1")
    assert result.ok and result.provider_message_id == "re_123"
    request = captured["request"]
    assert request.headers["authorization"] == "Bearer re_key"
    assert request.headers["idempotency-key"] == "n1-1"
    assert json.loads(request.content)["to"] == ["a@example.com"]


def test_resend_client_error_is_not_retryable_but_server_error_is():
    provider = ResendEmailProvider("k", "f@example.com", client=_client(lambda _r: httpx.Response(422, json={})))
    result = provider.send_email(to="a", subject="s", text="t", html="h", idempotency_key="k")
    assert not result.ok and result.error == "http_422" and result.retryable is False

    provider = ResendEmailProvider("k", "f@example.com", client=_client(lambda _r: httpx.Response(503)))
    assert provider.send_email(to="a", subject="s", text="t", html="h", idempotency_key="k").retryable is True


def test_network_error_is_retryable():
    def handler(request):
        raise httpx.ConnectError("down", request=request)

    provider = ResendEmailProvider("k", "f@example.com", client=_client(handler))
    result = provider.send_email(to="a", subject="s", text="t", html="h", idempotency_key="k")
    assert result.error == "ConnectError" and result.retryable


def _twilio(handler, content_sid=None, sms_from="+15550000000"):
    return TwilioMessagingProvider(
        account_sid="AC1",
        auth_token="tok",
        status_callback_url="https://safe.example/webhooks/twilio/status",
        whatsapp_from="+15551112222",
        whatsapp_content_sid=content_sid,
        sms_from=sms_from,
        client=_client(handler),
    )


def test_twilio_whatsapp_uses_template_when_configured():
    captured = {}

    def handler(request):
        captured["form"] = parse_qs(request.content.decode())
        captured["url"] = str(request.url)
        return httpx.Response(201, json={"sid": "SM1", "status": "queued"})

    result = _twilio(handler, content_sid="HX123").send_whatsapp(
        to="+27821234567", body="text", variables={"1": "Thandi"}
    )
    assert result.ok and result.provider_message_id == "SM1"
    form = captured["form"]
    assert form["To"] == ["whatsapp:+27821234567"]
    assert form["From"] == ["whatsapp:+15551112222"]
    assert form["ContentSid"] == ["HX123"]
    assert json.loads(form["ContentVariables"][0]) == {"1": "Thandi"}
    assert form["StatusCallback"] == ["https://safe.example/webhooks/twilio/status"]
    assert "/Accounts/AC1/Messages.json" in captured["url"]


def test_twilio_immediate_failure_status_is_a_failure():
    provider = _twilio(lambda _r: httpx.Response(201, json={"sid": "SM1", "status": "failed", "error_code": 63016}))
    result = provider.send_whatsapp(to="+27821234567", body="b", variables={})
    assert not result.ok and result.error == "twilio_63016"


def test_twilio_sms_without_sender_is_not_configured():
    provider = _twilio(lambda _r: httpx.Response(201, json={}), sms_from=None)
    assert provider.send_sms(to="+27821234567", body="b").error == "channel_not_configured"


def test_factories_fall_back_to_unconfigured_providers():
    settings = Settings()
    assert isinstance(build_email_provider(settings), UnconfiguredEmailProvider)
    assert isinstance(build_messaging_provider(settings), UnconfiguredMessagingProvider)
    assert build_geocoder(settings).reverse(0, 0) is None
    assert UnconfiguredEmailProvider().send_email(to="a", subject="s", text="t", html="h", idempotency_key="k").retryable is False


def test_factories_build_real_providers_from_settings():
    settings = Settings(
        resend_api_key="k",
        resend_from_email="a@example.com",
        twilio_account_sid="AC",
        twilio_auth_token="t",
        mapbox_server_token="sk",
    )
    assert isinstance(build_email_provider(settings), ResendEmailProvider)
    assert isinstance(build_messaging_provider(settings), TwilioMessagingProvider)
    assert isinstance(build_geocoder(settings), MapboxGeocoder)


def test_mapbox_geocoder_returns_full_address_and_survives_errors():
    ok = MapboxGeocoder(
        "pk", client=_client(lambda _r: httpx.Response(200, json={"features": [{"properties": {"full_address": "1 Main Rd"}}]}))
    )
    assert ok.reverse(1, 2) == "1 Main Rd"
    empty = MapboxGeocoder("pk", client=_client(lambda _r: httpx.Response(200, json={"features": []})))
    assert empty.reverse(1, 2) is None
    broken = MapboxGeocoder("pk", client=_client(lambda _r: httpx.Response(500)))
    assert broken.reverse(1, 2) is None


def test_settings_from_env():
    settings = Settings.from_env(
        {
            "DEADMAN_DB_PATH": "/tmp/x.db",
            "DEADMAN_CORS_ORIGINS": "https://a.example, https://b.example",
            "DEADMAN_ARCHIVE_RETENTION_DAYS": "90",
            "RESEND_API_KEY": "  ",
        }
    )
    assert settings.db_path == "/tmp/x.db"
    assert settings.cors_origins == ("https://a.example", "https://b.example")
    assert settings.archive_retention.days == 90
    assert settings.resend_api_key is None
    assert "secret" not in repr(Settings(resend_api_key="secret", twilio_auth_token="secret"))
