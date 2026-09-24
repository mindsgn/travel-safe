"""Message copy. Calm, factual, and explicit about what is known versus unknown."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html import escape

from deadman.timeutil import format_human


@dataclass(frozen=True)
class EmergencyMessage:
    user_name: str
    contact_name: str
    last_check_in_at: datetime | None
    deadline_at: datetime
    link_url: str
    link_expires_at: datetime
    timezone: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_recorded_at: datetime | None = None


def location_summary(message: EmergencyMessage) -> str:
    if message.latitude is None or message.longitude is None:
        return "No location was shared before the check-in was missed."
    place = message.address or f"{message.latitude:.5f}, {message.longitude:.5f}"
    when = format_human(message.location_recorded_at, message.timezone)
    return f"{place} (recorded {when})"


def email_subject(message: EmergencyMessage) -> str:
    return f"{message.user_name} missed a scheduled safety check-in"


def email_text(message: EmergencyMessage) -> str:
    zone = message.timezone
    return "\n".join(
        [
            f"Hi {message.contact_name},",
            "",
            f"{message.user_name} added you as an emergency contact in Travel Safe, an app that asks "
            "them to check in on a regular schedule.",
            "",
            "They didn't check in before their deadline, so we're letting you know. This doesn't "
            "necessarily mean something is wrong: their phone may be lost or out of battery, or they "
            "may simply have forgotten.",
            "",
            "What we know:",
            f"- Last check-in: {format_human(message.last_check_in_at, zone)}",
            f"- Check-in was due by: {format_human(message.deadline_at, zone)}",
            f"- Last known location: {location_summary(message)}",
            "",
            "What we don't know:",
            f"- Where {message.user_name} is right now, or whether they need help.",
            "",
            f"More details and a map: {message.link_url}",
            f"This private link expires {format_human(message.link_expires_at, zone)}. Please don't share it.",
            "",
            f"Suggested next step: try to contact {message.user_name} directly. If you believe they are "
            "in danger, contact your local emergency services.",
            "",
            "Travel Safe",
        ]
    )


def email_html(message: EmergencyMessage) -> str:
    zone = message.timezone
    name = escape(message.user_name)
    return f"""<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2024;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<p>Hi {escape(message.contact_name)},</p>
<p>{name} added you as an emergency contact in Travel Safe, an app that asks them to check in on a regular schedule.</p>
<p>They didn't check in before their deadline, so we're letting you know. This doesn't necessarily mean something is wrong: their phone may be lost or out of battery, or they may simply have forgotten.</p>
<h3 style="margin-bottom:4px">What we know</h3>
<ul>
<li>Last check-in: {escape(format_human(message.last_check_in_at, zone))}</li>
<li>Check-in was due by: {escape(format_human(message.deadline_at, zone))}</li>
<li>Last known location: {escape(location_summary(message))}</li>
</ul>
<h3 style="margin-bottom:4px">What we don't know</h3>
<ul><li>Where {name} is right now, or whether they need help.</li></ul>
<p><a href="{escape(message.link_url, quote=True)}" style="display:inline-block;background:#1f6f5c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">View details and map</a></p>
<p style="color:#60646c;font-size:13px">This private link expires {escape(format_human(message.link_expires_at, zone))}. Please don't share it.</p>
<p>Suggested next step: try to contact {name} directly. If you believe they are in danger, contact your local emergency services.</p>
<p style="color:#60646c;font-size:13px">Travel Safe</p>
</body></html>"""


def short_text(message: EmergencyMessage) -> str:
    return (
        f"Travel Safe: {message.user_name} missed a scheduled safety check-in "
        f"(due {format_human(message.deadline_at, message.timezone)}). This may not mean something is "
        f"wrong. Please try to contact them. Details and last known location: {message.link_url}"
    )
