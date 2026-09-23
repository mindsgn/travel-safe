from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import timedelta


def _optional(env: Mapping[str, str], key: str) -> str | None:
    value = env.get(key, "").strip()
    return value or None


def _int(env: Mapping[str, str], key: str, default: int) -> int:
    raw = env.get(key, "").strip()
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    db_path: str = "deadman.db"
    public_base_url: str = "http://127.0.0.1:8000"
    cors_origins: tuple[str, ...] = ()

    access_token_ttl: timedelta = timedelta(hours=1)
    refresh_token_ttl: timedelta = timedelta(days=180)

    location_retention: timedelta = timedelta(hours=24)
    emergency_link_ttl: timedelta = timedelta(days=30)
    archive_retention: timedelta = timedelta(days=90)

    notification_max_attempts: int = 3
    max_contacts_per_user: int = 10
    max_location_batch: int = 100
    worker_interval_seconds: int = 60

    resend_api_key: str | None = field(default=None, repr=False)
    resend_from_email: str | None = None

    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = field(default=None, repr=False)
    twilio_whatsapp_from: str | None = None
    twilio_whatsapp_content_sid: str | None = None
    twilio_sms_from: str | None = None

    mapbox_public_token: str | None = None
    mapbox_server_token: str | None = field(default=None, repr=False)

    @property
    def status_callback_url(self) -> str:
        return f"{self.public_base_url.rstrip('/')}/webhooks/twilio/status"

    def emergency_url(self, token: str) -> str:
        return f"{self.public_base_url.rstrip('/')}/e/{token}"

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        origins = tuple(
            origin.strip() for origin in env.get("DEADMAN_CORS_ORIGINS", "").split(",") if origin.strip()
        )
        return cls(
            db_path=env.get("DEADMAN_DB_PATH", "deadman.db"),
            public_base_url=env.get("DEADMAN_PUBLIC_BASE_URL", "http://127.0.0.1:8000"),
            cors_origins=origins,
            location_retention=timedelta(hours=_int(env, "DEADMAN_LOCATION_RETENTION_HOURS", 24)),
            emergency_link_ttl=timedelta(days=_int(env, "DEADMAN_EMERGENCY_LINK_TTL_DAYS", 30)),
            archive_retention=timedelta(days=_int(env, "DEADMAN_ARCHIVE_RETENTION_DAYS", 90)),
            notification_max_attempts=_int(env, "DEADMAN_NOTIFICATION_MAX_ATTEMPTS", 3),
            worker_interval_seconds=_int(env, "DEADMAN_WORKER_INTERVAL_SECONDS", 60),
            resend_api_key=_optional(env, "RESEND_API_KEY"),
            resend_from_email=_optional(env, "RESEND_FROM_EMAIL"),
            twilio_account_sid=_optional(env, "TWILIO_ACCOUNT_SID"),
            twilio_auth_token=_optional(env, "TWILIO_AUTH_TOKEN"),
            twilio_whatsapp_from=_optional(env, "TWILIO_WHATSAPP_FROM"),
            twilio_whatsapp_content_sid=_optional(env, "TWILIO_WHATSAPP_CONTENT_SID"),
            twilio_sms_from=_optional(env, "TWILIO_SMS_FROM"),
            mapbox_public_token=_optional(env, "MAPBOX_PUBLIC_TOKEN"),
            mapbox_server_token=_optional(env, "MAPBOX_SERVER_TOKEN"),
        )
