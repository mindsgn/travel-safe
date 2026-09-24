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
    UnconfiguredEmailProvider,
    UnconfiguredMessagingProvider,
    WhatsAppBotMessagingProvider,
)


def build_email_provider(settings: Settings) -> EmailProvider:
    if settings.resend_api_key and settings.resend_from_email:
        return ResendEmailProvider(settings.resend_api_key, settings.resend_from_email)
    return UnconfiguredEmailProvider()


def build_messaging_provider(settings: Settings) -> MessagingProvider:
    if settings.whatsapp_bot_url:
        return WhatsAppBotMessagingProvider(settings.whatsapp_bot_url, settings.whatsapp_bot_token)
    return UnconfiguredMessagingProvider()


def build_geocoder(settings: Settings) -> ReverseGeocoder:
    token = settings.mapbox_server_token or settings.mapbox_public_token
    return MapboxGeocoder(token) if token else NullGeocoder()


def build_dispatcher(settings: Settings) -> Dispatcher:
    return Dispatcher(settings, build_email_provider(settings), build_messaging_provider(settings))
