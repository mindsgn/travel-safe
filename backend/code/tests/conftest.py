from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from deadman.api.app import create_app
from deadman.config import Settings
from deadman.db import connect
from deadman.geocoding import NullGeocoder
from deadman.notifications.dispatcher import Dispatcher
from deadman.notifications.providers import SendResult
from deadman.timeutil import UTC
from deadman.worker import run_once

START = datetime(2026, 1, 10, 9, 0, 0, tzinfo=UTC)


class MutableClock:
    def __init__(self, start: datetime = START) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs: float) -> datetime:
        self.now = self.now + timedelta(**kwargs)
        return self.now


@dataclass
class FakeEmail:
    result: SendResult = field(default_factory=lambda: SendResult(ok=True, provider_message_id="email-1"))
    sent: list[dict] = field(default_factory=list)

    def send_email(self, *, to: str, subject: str, text: str, html: str, idempotency_key: str) -> SendResult:
        self.sent.append(
            {"to": to, "subject": subject, "text": text, "html": html, "idempotency_key": idempotency_key}
        )
        return self.result


@dataclass
class FakeMessaging:
    whatsapp_result: SendResult = field(default_factory=lambda: SendResult(ok=True, provider_message_id="SMwa"))
    sms_result: SendResult = field(default_factory=lambda: SendResult(ok=True, provider_message_id="SMsms"))
    whatsapp: list[dict] = field(default_factory=list)
    sms: list[dict] = field(default_factory=list)

    def send_whatsapp(self, *, to: str, body: str, variables: dict[str, str]) -> SendResult:
        self.whatsapp.append({"to": to, "body": body, "variables": variables})
        return self.whatsapp_result

    def send_sms(self, *, to: str, body: str) -> SendResult:
        self.sms.append({"to": to, "body": body})
        return self.sms_result


class FixedGeocoder:
    def __init__(self, address: str | None = "12 Long Street, Cape Town") -> None:
        self.address = address
        self.calls = 0

    def reverse(self, latitude: float, longitude: float) -> str | None:
        self.calls += 1
        return self.address


@pytest.fixture
def clock() -> MutableClock:
    return MutableClock()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        db_path=str(tmp_path / "deadman.db"),
        public_base_url="https://safe.example",
        mapbox_public_token="pk.test",
        twilio_auth_token="twilio-secret",
        # Tests move the clock by days or months; token expiry has its own dedicated tests.
        access_token_ttl=timedelta(days=3650),
        refresh_token_ttl=timedelta(days=7300),
    )


@pytest.fixture
def db(settings):
    connection = connect(settings.db_path)
    yield connection
    connection.close()


@pytest.fixture
def email() -> FakeEmail:
    return FakeEmail()


@pytest.fixture
def messaging() -> FakeMessaging:
    return FakeMessaging()


@pytest.fixture
def dispatcher(settings, email, messaging) -> Dispatcher:
    return Dispatcher(settings, email, messaging)


@pytest.fixture
def run_worker(db, settings, dispatcher, clock):
    def _run(geocoder=None):
        return run_once(db, settings=settings, dispatcher=dispatcher, geocoder=geocoder or NullGeocoder(), now=clock())

    return _run


@pytest.fixture
def client(settings, clock):
    app = create_app(settings, clock=clock)
    with TestClient(app) as test_client:
        yield test_client


@dataclass
class Account:
    user_id: str
    account_key: str
    access_token: str
    refresh_token: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


@pytest.fixture
def register(client):
    def _register(name: str = "Thandi", interval: int = 1, timezone: str | None = "Africa/Johannesburg") -> Account:
        response = client.post(
            "/api/v1/auth/register",
            json={"name": name, "check_in_interval_days": interval, "timezone": timezone},
        )
        assert response.status_code == 201, response.text
        body = response.json()
        return Account(
            user_id=body["user_id"],
            account_key=body["account_key"],
            access_token=body["tokens"]["access_token"],
            refresh_token=body["tokens"]["refresh_token"],
        )

    return _register


@pytest.fixture
def check_in(client, clock):
    counter = {"n": 0}

    def _check_in(account: Account, **extra) -> dict:
        counter["n"] += 1
        payload = {"client_id": f"client-{counter['n']:04d}", "occurred_at": clock().isoformat(), **extra}
        response = client.post("/api/v1/check-ins", json=payload, headers=account.headers)
        assert response.status_code in (200, 201), response.text
        return response.json()

    return _check_in


@pytest.fixture
def add_contact(client):
    def _add(account: Account, **fields) -> dict:
        payload = {"name": "Sipho", "email": "sipho@example.com", "phone": None, "whatsapp": False, **fields}
        response = client.post("/api/v1/contacts", json=payload, headers=account.headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _add


def with_settings(settings: Settings, **changes) -> Settings:
    return replace(settings, **changes)
