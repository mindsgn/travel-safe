from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


@dataclass(frozen=True)
class SendResult:
    ok: bool
    provider_message_id: str | None = None
    error: str | None = None
    retryable: bool = True


NOT_CONFIGURED = SendResult(ok=False, error="channel_not_configured", retryable=False)


class EmailProvider(Protocol):
    def send_email(
        self, *, to: str, subject: str, text: str, html: str, idempotency_key: str
    ) -> SendResult: ...


class MessagingProvider(Protocol):
    def send_whatsapp(self, *, to: str, body: str) -> SendResult: ...


def _http_failure(error: httpx.HTTPError) -> SendResult:
    if isinstance(error, httpx.HTTPStatusError):
        status = error.response.status_code
        # 4xx (other than rate limiting) means the request itself is wrong: retrying won't help.
        retryable = status == 429 or status >= 500
        return SendResult(ok=False, error=f"http_{status}", retryable=retryable)
    return SendResult(ok=False, error=type(error).__name__, retryable=True)


class UnconfiguredEmailProvider:
    def send_email(self, *, to: str, subject: str, text: str, html: str, idempotency_key: str) -> SendResult:
        return NOT_CONFIGURED


class UnconfiguredMessagingProvider:
    def send_whatsapp(self, *, to: str, body: str) -> SendResult:
        return NOT_CONFIGURED


class WhatsAppBotMessagingProvider:
    """Sends WhatsApp messages through the whatsapp-bot HTTP gateway.

    The gateway pairs once via QR code (WhatsApp > Linked Devices) and exposes
    POST /send expecting multipart fields `phone` and `message`. It returns
    {"ok": true, "id": ...} on success and errors like {ok: false, error} with a
    non-2xx status otherwise.
    """

    def __init__(
        self, base_url: str, token: str | None = None, client: httpx.Client | None = None
    ) -> None:
        self._base = base_url.rstrip("/")
        self._token = token
        self._client = client or httpx.Client(timeout=30)

    def send_whatsapp(self, *, to: str, body: str) -> SendResult:
        headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}
        try:
            response = self._client.post(
                f"{self._base}/send",
                headers=headers,
                files={"phone": (None, to), "message": (None, body)},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            return self._status_failure(error.response.status_code)
        except httpx.HTTPError as error:
            logger.warning("whatsapp-bot send failed: %s", type(error).__name__)
            return _http_failure(error)
        payload = response.json()
        if not payload.get("ok"):
            return SendResult(ok=False, error="whatsapp_send_failed", retryable=True)
        return SendResult(ok=True, provider_message_id=payload.get("id"))

    @staticmethod
    def _status_failure(status: int) -> SendResult:
        if status == 503:
            # The gateway is not connected to WhatsApp (no paired device).
            return SendResult(ok=False, error="whatsapp_not_connected", retryable=False)
        retryable = status == 429 or status >= 500
        return SendResult(ok=False, error=f"http_{status}", retryable=retryable)


class ResendEmailProvider:
    def __init__(self, api_key: str, from_email: str, client: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._from = from_email
        self._client = client or httpx.Client(timeout=15)

    def send_email(self, *, to: str, subject: str, text: str, html: str, idempotency_key: str) -> SendResult:
        try:
            response = self._client.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Idempotency-Key": idempotency_key,
                },
                json={"from": self._from, "to": [to], "subject": subject, "text": text, "html": html},
            )
            response.raise_for_status()
            return SendResult(ok=True, provider_message_id=response.json().get("id"))
        except httpx.HTTPError as error:
            logger.warning("Resend send failed: %s", type(error).__name__)
            return _http_failure(error)
