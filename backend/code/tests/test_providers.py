import json

import httpx
import pytest

from deadman.config import Settings
from deadman.geocoding import MapboxGeocoder
from deadman.notifications.providers import (
    ResendEmailProvider,
    UnconfiguredEmailProvider,
    UnconfiguredMessagingProvider,
    WhatsAppBotMessagingProvider,
)
from deadman.services import build_email_provider, build_geocoder, build_messaging_provider


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def _bot(handler, token=None):
    return WhatsAppBotMessagingProvider("http://bot.local", token=token, client=_client(handler))


def _form_fields(request: httpx.Request) -> dict[str, str]:
    boundary = request.headers["content-type"].split("boundary=")[1].encode()
    content = request.content.split(b"--" + boundary)
    fields: dict[str, str] = {}
    for part in content:
        if b"Content-Disposition: form-data; name=" not in part:
            continue
        header, _, value = part.partition(b"\r\n\r\n")
        name = header.split(b'name="')[1].split(b'"')[0].decode()
        fields[name] = value.decode().strip()
    return fields


def test_resend_sends_expected_request():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json={"id": "re_123"})

    provider = ResendEmailProvider("re_key", "Travel Safe <alerts@example.com>", client=_client(handler))
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


def test_whatsapp_bot_sends_multipart_phone_and_message():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = request.headers
        captured["fields"] = _form_fields(request)
        return httpx.Response(200, json={"ok": True, "id": "3EB0C1", "jid": "2782@s.whatsapp.net"})

    result = _bot(handler).send_whatsapp(to="+27821234567", body="Travel Safe: Thandi missed...")
    assert result.ok and result.provider_message_id == "3EB0C1"
    assert captured["url"].endswith("/send")
    assert captured["fields"]["phone"] == "+27821234567"
    assert captured["fields"]["message"] == "Travel Safe: Thandi missed..."
    assert captured["headers"]["content-type"].startswith("multipart/form-data")


def test_whatsapp_bot_sends_token_when_configured():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"ok": True, "id": "M1"})

    assert _bot(handler, token="secret").send_whatsapp(to="+27821234567", body="b").ok
    assert captured["auth"] == "Bearer secret"


def test_whatsapp_bot_ok_false_is_still_a_failure():
    provider = _bot(lambda _r: httpx.Response(200, json={"ok": False, "error": "boom"}))
    result = provider.send_whatsapp(to="+27821234567", body="b")
    assert not result.ok and result.error == "whatsapp_send_failed" and result.retryable


def test_whatsapp_bot_400_is_not_retryable():
    provider = _bot(lambda _r: httpx.Response(400, json={"ok": False, "error": "missing phone"}))
    result = provider.send_whatsapp(to="", body="b")
    assert not result.ok and result.error == "http_400" and result.retryable is False


def test_whatsapp_bot_503_means_not_connected_and_is_not_retried():
    provider = _bot(lambda _r: httpx.Response(503, json={"ok": False, "error": "not connected"}))
    result = provider.send_whatsapp(to="+27821234567", body="b")
    assert not result.ok and result.error == "whatsapp_not_connected" and result.retryable is False


@pytest.mark.parametrize("status", [429, 500, 502])
def test_whatsapp_bot_transient_errors_are_retryable(status):
    provider = _bot(lambda _r: httpx.Response(status, json={}))
    result = provider.send_whatsapp(to="+27821234567", body="b")
    assert not result.ok and result.error == f"http_{status}" and result.retryable is True


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
        whatsapp_bot_url="http://bot.local",
        mapbox_server_token="sk",
    )
    assert isinstance(build_email_provider(settings), ResendEmailProvider)
    assert isinstance(build_messaging_provider(settings), WhatsAppBotMessagingProvider)
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
            "WHATSAPP_BOT_URL": "http://bot.local/",
            "WHATSAPP_BOT_TOKEN": "token",
        }
    )
    assert settings.db_path == "/tmp/x.db"
    assert settings.cors_origins == ("https://a.example", "https://b.example")
    assert settings.archive_retention.days == 90
    assert settings.resend_api_key is None
    assert settings.whatsapp_bot_url == "http://bot.local/"
    assert settings.whatsapp_bot_token == "token"
    assert "secret" not in repr(Settings(resend_api_key="secret", whatsapp_bot_token="secret"))
