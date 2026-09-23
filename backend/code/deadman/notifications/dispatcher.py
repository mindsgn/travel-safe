"""Send pending emergency notifications exactly once where possible.

A notification is claimed with a conditional UPDATE (pending/failed -> sending) before
any network call, so two workers can never send the same row. If a worker dies mid-send
the row stays in 'sending' and is not retried automatically: we prefer a visible stuck
row over a duplicate emergency message.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime

from deadman.config import Settings
from deadman.db import transaction
from deadman.links import mint_link
from deadman.notifications.messages import (
    EmergencyMessage,
    email_html,
    email_subject,
    email_text,
    short_text,
    whatsapp_template_variables,
)
from deadman.notifications.providers import EmailProvider, MessagingProvider, SendResult
from deadman.timeutil import from_db, to_db

logger = logging.getLogger(__name__)

DELIVERY_STATUS_MAP = {
    "delivered": "delivered",
    "read": "delivered",
    "failed": "failed",
    "undelivered": "failed",
}


@dataclass
class DispatchSummary:
    sent: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    cancelled: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class _Claim:
    notification_id: str
    channel: str
    recipient: str
    attempt: int
    message: EmergencyMessage


class Dispatcher:
    def __init__(self, settings: Settings, email: EmailProvider, messaging: MessagingProvider) -> None:
        self._settings = settings
        self._email = email
        self._messaging = messaging

    def _candidates(self, connection: sqlite3.Connection) -> list[str]:
        rows = connection.execute(
            """
            SELECT id FROM notification_events
            WHERE status = 'pending' OR (status = 'failed' AND retryable = 1 AND attempts < ?)
            ORDER BY created_at
            """,
            (self._settings.notification_max_attempts,),
        ).fetchall()
        return [row["id"] for row in rows]

    def _claim(self, connection: sqlite3.Connection, notification_id: str, now: datetime) -> _Claim | str | None:
        """Returns a claim to send, 'cancelled' if the event no longer needs it, or None."""
        with transaction(connection):
            cursor = connection.execute(
                """
                UPDATE notification_events
                SET status = 'sending', attempts = attempts + 1, updated_at = ?
                WHERE id = ? AND (status = 'pending' OR (status = 'failed' AND retryable = 1 AND attempts < ?))
                """,
                (to_db(now), notification_id, self._settings.notification_max_attempts),
            )
            if cursor.rowcount != 1:
                return None
            row = connection.execute(
                """
                SELECT n.id, n.channel, n.recipient, n.recipient_name, n.attempts, n.deadman_event_id,
                       e.status AS event_status, e.deadline_at, e.triggered_at, e.last_check_in_at,
                       e.latitude, e.longitude, e.location_recorded_at, e.address,
                       u.name AS user_name, u.timezone, u.archived_at
                FROM notification_events n
                JOIN deadman_events e ON e.id = n.deadman_event_id
                JOIN users u ON u.id = e.user_id
                WHERE n.id = ?
                """,
                (notification_id,),
            ).fetchone()
            if row["event_status"] != "triggered" or row["archived_at"] is not None:
                connection.execute(
                    "UPDATE notification_events SET status = 'cancelled', updated_at = ? WHERE id = ?",
                    (to_db(now), notification_id),
                )
                return "cancelled"
            triggered_at = from_db(row["triggered_at"])
            assert triggered_at is not None
            expires_at = triggered_at + self._settings.emergency_link_ttl
            token = mint_link(
                connection,
                event_id=row["deadman_event_id"],
                notification_id=notification_id,
                expires_at=expires_at,
                now=now,
            )
            deadline = from_db(row["deadline_at"])
            assert deadline is not None
            message = EmergencyMessage(
                user_name=row["user_name"],
                contact_name=row["recipient_name"],
                last_check_in_at=from_db(row["last_check_in_at"]),
                deadline_at=deadline,
                link_url=self._settings.emergency_url(token),
                link_expires_at=expires_at,
                timezone=row["timezone"],
                address=row["address"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                location_recorded_at=from_db(row["location_recorded_at"]),
            )
            return _Claim(notification_id, row["channel"], row["recipient"], int(row["attempts"]), message)

    def _send(self, claim: _Claim) -> SendResult:
        message = claim.message
        if claim.channel == "email":
            return self._email.send_email(
                to=claim.recipient,
                subject=email_subject(message),
                text=email_text(message),
                html=email_html(message),
                idempotency_key=f"{claim.notification_id}-{claim.attempt}",
            )
        if claim.channel == "whatsapp":
            return self._messaging.send_whatsapp(
                to=claim.recipient, body=short_text(message), variables=whatsapp_template_variables(message)
            )
        if claim.channel == "sms":
            return self._messaging.send_sms(to=claim.recipient, body=short_text(message))
        return SendResult(ok=False, error="unknown_channel", retryable=False)

    def _record(self, connection: sqlite3.Connection, claim: _Claim, result: SendResult, now: datetime) -> None:
        with transaction(connection):
            if result.ok:
                connection.execute(
                    """
                    UPDATE notification_events
                    SET status = 'sent', provider_message_id = ?, failure_reason = NULL, sent_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (result.provider_message_id, to_db(now), to_db(now), claim.notification_id),
                )
            else:
                connection.execute(
                    """
                    UPDATE notification_events
                    SET status = 'failed', failure_reason = ?, retryable = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (result.error or "unknown_error", int(result.retryable), to_db(now), claim.notification_id),
                )

    def dispatch_pending(self, connection: sqlite3.Connection, now: datetime) -> DispatchSummary:
        summary = DispatchSummary()
        for notification_id in self._candidates(connection):
            claim = self._claim(connection, notification_id, now)
            if claim is None:
                continue
            if claim == "cancelled":
                summary.cancelled.append(notification_id)
                continue
            assert isinstance(claim, _Claim)
            try:
                result = self._send(claim)
            except Exception as error:  # a provider bug must not leave the row silently "sending"
                logger.exception("Notification provider raised")
                result = SendResult(ok=False, error=f"provider_error:{type(error).__name__}", retryable=True)
            self._record(connection, claim, result, now)
            (summary.sent if result.ok else summary.failed).append(notification_id)
        return summary


def apply_delivery_status(
    connection: sqlite3.Connection,
    provider_message_id: str,
    provider_status: str,
    error_code: str | None,
    now: datetime,
) -> bool:
    """Apply a provider delivery callback. Never downgrades a delivered message."""
    status = DELIVERY_STATUS_MAP.get(provider_status)
    if status is None:
        return False
    with transaction(connection):
        if status == "delivered":
            cursor = connection.execute(
                """
                UPDATE notification_events SET status = 'delivered', updated_at = ?
                WHERE provider_message_id = ? AND status IN ('sent', 'delivered')
                """,
                (to_db(now), provider_message_id),
            )
        else:
            cursor = connection.execute(
                """
                UPDATE notification_events
                SET status = 'failed', retryable = 0, failure_reason = ?, updated_at = ?
                WHERE provider_message_id = ? AND status = 'sent'
                """,
                (f"delivery_failed:{error_code or provider_status}", to_db(now), provider_message_id),
            )
    return cursor.rowcount > 0
