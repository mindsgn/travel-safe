"""Unauthenticated endpoints: the emergency page (capability-token access) and provider webhooks."""

from __future__ import annotations

import secrets
from urllib.parse import parse_qsl

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse

from deadman.api.deps import AppSettings, Db, Now
from deadman.links import resolve_link
from deadman.notifications.dispatcher import apply_delivery_status
from deadman.security import verify_twilio_signature
from deadman.web.emergency_page import build_view, content_security_policy, render_page, render_unavailable

router = APIRouter()

PRIVATE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
}


@router.get("/e/{token}", response_class=HTMLResponse)
def emergency_page(token: str, db: Db, now: Now, settings: AppSettings) -> HTMLResponse:
    nonce = secrets.token_urlsafe(16)
    headers = {**PRIVATE_HEADERS, "Content-Security-Policy": content_security_policy(nonce)}
    link = resolve_link(db, token, now)
    if link is None:
        return HTMLResponse(render_unavailable(), status_code=404, headers=headers)
    view = build_view(db, link["deadman_event_id"], link["expires_at"])
    return HTMLResponse(render_page(view, settings.mapbox_public_token, nonce), headers=headers)


@router.get("/api/v1/emergency/{token}")
def emergency_data(token: str, db: Db, now: Now) -> JSONResponse:
    """JSON form of the emergency page so a separate web frontend can evolve independently."""
    link = resolve_link(db, token, now)
    if link is None:
        return JSONResponse({"error": {"code": "link_unavailable"}}, status_code=404, headers=PRIVATE_HEADERS)
    view = build_view(db, link["deadman_event_id"], link["expires_at"])
    return JSONResponse(view, headers=PRIVATE_HEADERS)


@router.post("/webhooks/twilio/status")
async def twilio_status(request: Request, db: Db, now: Now, settings: AppSettings) -> Response:
    if not settings.twilio_auth_token:
        return Response(status_code=404)
    params = dict(parse_qsl((await request.body()).decode("utf-8"), keep_blank_values=True))
    signature = request.headers.get("X-Twilio-Signature")
    if not verify_twilio_signature(settings.twilio_auth_token, settings.status_callback_url, params, signature):
        return Response(status_code=403)
    message_sid = params.get("MessageSid")
    status = params.get("MessageStatus")
    if message_sid and status:
        apply_delivery_status(db, message_sid, status, params.get("ErrorCode"), now)
    return Response(status_code=204)
