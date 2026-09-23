from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"
TWILIO_MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


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
    def send_whatsapp(self, *, to: str, body: str, variables: dict[str, str]) -> SendResult: ...

    def send_sms(self, *, to: str, body: str) -> SendResult: ...


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
    def send_whatsapp(self, *, to: str, body: str, variables: dict[str, str]) -> SendResult:
        return NOT_CONFIGURED

    def send_sms(self, *, to: str, body: str) -> SendResult:
        return NOT_CONFIGURED


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


class TwilioMessagingProvider:
    """WhatsApp via the WhatsApp Business Platform through Twilio, plus plain SMS.

    Business-initiated WhatsApp messages require a pre-approved template; set
    TWILIO_WHATSAPP_CONTENT_SID to its Content SID. Without it the body is sent as
    free-form text, which only works inside a 24h session or the Twilio sandbox.
    """

    def __init__(
        self,
        *,
        account_sid: str,
        auth_token: str,
        status_callback_url: str,
        whatsapp_from: str | None,
        whatsapp_content_sid: str | None,
        sms_from: str | None,
        client: httpx.Client | None = None,
    ) -> None:
        self._sid = account_sid
        self._token = auth_token
        self._callback = status_callback_url
        self._whatsapp_from = whatsapp_from
        self._content_sid = whatsapp_content_sid
        self._sms_from = sms_from
        self._client = client or httpx.Client(timeout=15)

    def _post(self, data: dict[str, str]) -> SendResult:
        try:
            response = self._client.post(
                TWILIO_MESSAGES_URL.format(sid=self._sid),
                auth=(self._sid, self._token),
                data={**data, "StatusCallback": self._callback},
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as error:
            logger.warning("Twilio send failed: %s", type(error).__name__)
            return _http_failure(error)
        if payload.get("status") in {"failed", "undelivered"}:
            return SendResult(ok=False, error=f"twilio_{payload.get('error_code')}", retryable=False)
        return SendResult(ok=True, provider_message_id=payload.get("sid"))

    def send_whatsapp(self, *, to: str, body: str, variables: dict[str, str]) -> SendResult:
        if not self._whatsapp_from:
            return NOT_CONFIGURED
        data = {"From": f"whatsapp:{self._whatsapp_from}", "To": f"whatsapp:{to}"}
        if self._content_sid:
            data["ContentSid"] = self._content_sid
            data["ContentVariables"] = json.dumps(variables)
        else:
            data["Body"] = body
        return self._post(data)

    def send_sms(self, *, to: str, body: str) -> SendResult:
        if not self._sms_from:
            return NOT_CONFIGURED
        return self._post({"From": self._sms_from, "To": to, "Body": body})
