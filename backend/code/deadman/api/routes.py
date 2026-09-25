from __future__ import annotations

from fastapi import APIRouter, Response

from deadman import accounts, checkins, contacts, engine, locations, profiles
from deadman.api.deps import AppSettings, Db, Messaging, Now, Token, UserId
from deadman.api.schemas import (
    CheckInRequest,
    ContactPayload,
    LocationBatch,
    LoginRequest,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)
from deadman.checkins import DeviceState
from deadman.db import transaction
from deadman.errors import ServiceUnavailableError, ValidationFailed
from deadman.notifications.messages import alert_test_text
from deadman.profiles import validate_name

router = APIRouter(prefix="/api/v1")


def _device(payload) -> DeviceState | None:
    if payload is None:
        return None
    return DeviceState(battery_level=payload.battery_level, low_power_mode=payload.low_power_mode)


# --- Authentication -----------------------------------------------------------------


@router.post("/auth/register", status_code=201)
def register(payload: RegisterRequest, db: Db, now: Now, settings: AppSettings) -> RegisterResponse:
    result = accounts.register(
        db,
        name=validate_name(payload.name),
        interval_days=payload.check_in_interval_days,
        timezone=payload.timezone,
        now=now,
        settings=settings,
    )
    return RegisterResponse(
        user_id=result.user_id, account_key=result.account_key, tokens=TokenResponse.from_pair(result.tokens)
    )


@router.post("/auth/login")
def login(payload: LoginRequest, db: Db, now: Now, settings: AppSettings) -> TokenResponse:
    pair = accounts.login(db, user_id=payload.user_id, account_key=payload.account_key, now=now, settings=settings)
    return TokenResponse.from_pair(pair)


@router.post("/auth/refresh")
def refresh(payload: RefreshRequest, db: Db, now: Now, settings: AppSettings) -> TokenResponse:
    return TokenResponse.from_pair(
        accounts.refresh(db, refresh_token=payload.refresh_token, now=now, settings=settings)
    )


@router.post("/auth/logout", status_code=204)
def logout(db: Db, token: Token, _user: UserId) -> Response:
    accounts.logout(db, access_token=token)
    return Response(status_code=204)


# --- Profile ------------------------------------------------------------------------


@router.get("/me")
def get_me(db: Db, user_id: UserId) -> dict:
    return profiles.get_profile(db, user_id)


@router.patch("/me")
def update_me(payload: ProfileUpdate, db: Db, now: Now, user_id: UserId) -> dict:
    return profiles.update_profile(
        db,
        user_id,
        now=now,
        name=payload.name,
        timezone=payload.timezone,
        interval_days=payload.check_in_interval_days,
    )


@router.delete("/me")
def delete_me(db: Db, now: Now, settings: AppSettings, user_id: UserId) -> dict:
    purge_after = profiles.archive_profile(db, user_id, now=now, settings=settings)
    return {"archived": True, "purge_after": purge_after}


# --- Check-ins ----------------------------------------------------------------------


@router.post("/check-ins")
def create_check_in(
    payload: CheckInRequest, response: Response, db: Db, now: Now, settings: AppSettings, user_id: UserId
) -> dict:
    result = checkins.record_check_in(
        db,
        user_id=user_id,
        client_id=payload.client_id,
        occurred_at=payload.occurred_at,
        now=now,
        settings=settings,
        location=payload.location.to_point() if payload.location else None,
        device=_device(payload.device),
    )
    response.status_code = 201 if result.created else 200
    return {
        "check_in": result.check_in,
        "created": result.created,
        "resolved_event_ids": result.resolved_event_ids,
        "status": profiles.switch_status(db, user_id, now),
    }


@router.get("/check-ins/latest")
def get_latest_check_in(db: Db, user_id: UserId) -> dict:
    return {"check_in": checkins.latest_check_in(db, user_id)}


@router.get("/check-ins/status")
def get_check_in_status(db: Db, now: Now, user_id: UserId) -> dict:
    return profiles.switch_status(db, user_id, now)


# --- Contacts -----------------------------------------------------------------------


@router.get("/contacts")
def list_contacts(db: Db, user_id: UserId) -> dict:
    return {"contacts": contacts.list_contacts(db, user_id)}


@router.post("/contacts", status_code=201)
def add_contact(payload: ContactPayload, db: Db, now: Now, settings: AppSettings, user_id: UserId) -> dict:
    contact = contacts.validate_contact(payload.name, payload.email, payload.phone, payload.whatsapp)
    return contacts.add_contact(db, user_id, contact, now, settings)


def _test_alert_error_code(failure: str | None) -> str:
    if failure in (None, "", "channel_not_configured"):
        return "whatsapp_not_configured"
    if failure == "whatsapp_not_connected":
        return "whatsapp_not_connected"
    return "whatsapp_test_failed"


@router.post("/contacts/test-message")
def test_contact_message(payload: ContactPayload, messaging: Messaging, db: Db, user_id: UserId) -> dict:
    """Rehearses the emergency alert to a contact's number before they are saved.

    The app gates saving on this: a phone number is only stored once it is known to
    receive alerts, so a mistyped or unreachable number is caught at the point it is
    entered rather than when it matters. Every phone number is alerted over WhatsApp
    (see engine.channels_for_contact), so a number saved without the WhatsApp toggle
    is verified exactly the same way.

    Nothing is persisted and no real event is created: this is a send, not a trigger.
    """
    contact = contacts.validate_contact(payload.name, payload.email, payload.phone, payload.whatsapp)
    if contact.phone is None:
        raise ValidationFailed("phone_required", "A phone number is needed to send a test alert.", "phone")
    user_name = profiles.get_profile(db, user_id)["name"]
    result = messaging.send_whatsapp(to=contact.phone, body=alert_test_text(user_name, contact.name))
    if not result.ok:
        raise ServiceUnavailableError(
            _test_alert_error_code(result.error),
            "We couldn't send a test alert to this number. Check the number and try again.",
        )
    return {"sent": True, "message_id": result.provider_message_id}


@router.get("/contacts/{contact_id}")
def get_contact(contact_id: str, db: Db, user_id: UserId) -> dict:
    return contacts.get_contact(db, user_id, contact_id)


@router.put("/contacts/{contact_id}")
def update_contact(contact_id: str, payload: ContactPayload, db: Db, now: Now, user_id: UserId) -> dict:
    contact = contacts.validate_contact(payload.name, payload.email, payload.phone, payload.whatsapp)
    return contacts.update_contact(db, user_id, contact_id, contact, now)


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: str, db: Db, user_id: UserId) -> Response:
    contacts.delete_contact(db, user_id, contact_id)
    return Response(status_code=204)


# --- Locations ----------------------------------------------------------------------


@router.post("/locations", status_code=201)
def upload_locations(payload: LocationBatch, db: Db, now: Now, settings: AppSettings, user_id: UserId) -> dict:
    stored = locations.upload_points(
        db, user_id, [point.to_point() for point in payload.points], payload.source, now, settings
    )
    if payload.device is not None:
        with transaction(db):
            checkins.update_device_state(db, user_id, _device(payload.device), now)
    return {"stored": stored, "last_known": locations.get_last_known(db, user_id)}


@router.get("/locations/last")
def last_location(db: Db, user_id: UserId) -> dict:
    return {"last_known": locations.get_last_known(db, user_id)}


# --- Travel Safe -----------------------------------------------------------------


@router.get("/switch/status")
def switch_status(db: Db, now: Now, user_id: UserId) -> dict:
    status = profiles.switch_status(db, user_id, now)
    status["latest_event"] = engine.latest_event_status(db, user_id)
    return status


@router.get("/switch/deadline")
def switch_deadline(db: Db, now: Now, user_id: UserId) -> dict:
    status = profiles.switch_status(db, user_id, now)
    return {key: status[key] for key in ("next_deadline_at", "seconds_remaining", "deadline_passed", "server_time")}


@router.get("/switch/events/latest")
def latest_event(db: Db, user_id: UserId) -> dict:
    return {"event": engine.latest_event_status(db, user_id)}
