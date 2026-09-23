"""Builds external-service adapters from settings. Missing credentials yield adapters
that fail loudly (status 'failed', reason 'channel_not_configured') instead of
pretending a notification was sent."""

from __future__ import annotations

from deadman.config import Settings
from deadman.geocoding import MapboxGeocoder, NullGeocoder, ReverseGeocoder
from deadman.notifications.dispatcher import Dispatcher
from deadman.notifications.providers import (
    EmailProvider,
    MessagingProvider,
    ResendEmailProvider,
    TwilioMessagingProvider,
    UnconfiguredEmailProvider,
    UnconfiguredMessagingProvider,
)


def build_email_provider(settings: Settings) -> EmailProvider:
    if settings.resend_api_key and settings.resend_from_email:
        return ResendEmailProvider(settings.resend_api_key, settings.resend_from_email)
    return UnconfiguredEmailProvider()


def build_messaging_provider(settings: Settings) -> MessagingProvider:
    if settings.twilio_account_sid and settings.twilio_auth_token:
        return TwilioMessagingProvider(
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
            status_callback_url=settings.status_callback_url,
            whatsapp_from=settings.twilio_whatsapp_from,
            whatsapp_content_sid=settings.twilio_whatsapp_content_sid,
            sms_from=settings.twilio_sms_from,
        )
    return UnconfiguredMessagingProvider()


def build_geocoder(settings: Settings) -> ReverseGeocoder:
    token = settings.mapbox_server_token or settings.mapbox_public_token
    return MapboxGeocoder(token) if token else NullGeocoder()


def build_dispatcher(settings: Settings) -> Dispatcher:
    return Dispatcher(settings, build_email_provider(settings), build_messaging_provider(settings))
