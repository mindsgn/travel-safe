from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from collections.abc import Mapping


def new_id() -> str:
    """Opaque primary key. Never sequential, so it leaks nothing if exposed."""
    return uuid.uuid4().hex


def new_secret(prefix: str, nbytes: int = 32) -> str:
    return f"{prefix}_{secrets.token_urlsafe(nbytes)}"


def new_link_token() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    """Secrets are 256-bit random values, so a fast hash is sufficient (no brute-force risk)."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def secrets_match(candidate: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(candidate), expected_hash)


def twilio_signature(auth_token: str, url: str, params: Mapping[str, str]) -> str:
    payload = url + "".join(f"{key}{params[key]}" for key in sorted(params))
    digest = hmac.new(auth_token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("ascii")


def verify_twilio_signature(
    auth_token: str, url: str, params: Mapping[str, str], signature: str | None
) -> bool:
    if not signature:
        return False
    return hmac.compare_digest(twilio_signature(auth_token, url, params), signature)
