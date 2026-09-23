from datetime import timedelta

import pytest

from deadman import accounts
from deadman.errors import AuthError
from deadman.security import hash_secret
from tests.conftest import START


def _register(db, settings, now=START):
    return accounts.register(db, name="Thandi", interval_days=7, timezone=None, now=now, settings=settings)


def test_register_stores_only_hashes(db, settings):
    registration = _register(db, settings)
    user = db.execute("SELECT account_key_hash FROM users WHERE id = ?", (registration.user_id,)).fetchone()
    assert user["account_key_hash"] == hash_secret(registration.account_key)
    session = db.execute("SELECT * FROM auth_sessions").fetchone()
    assert registration.tokens.access_token not in dict(session).values()
    assert registration.tokens.refresh_token not in dict(session).values()


def test_authenticate_accepts_valid_access_token(db, settings):
    registration = _register(db, settings)
    assert accounts.authenticate(db, access_token=registration.tokens.access_token, now=START) == registration.user_id


def test_expired_access_token_is_rejected(db, settings):
    registration = _register(db, settings)
    with pytest.raises(AuthError, match="token_expired"):
        accounts.authenticate(
            db, access_token=registration.tokens.access_token, now=START + settings.access_token_ttl
        )


def test_unknown_token_is_rejected(db, settings):
    _register(db, settings)
    with pytest.raises(AuthError):
        accounts.authenticate(db, access_token="at_nope", now=START)


def test_refresh_rotates_tokens_and_old_refresh_token_stops_working(db, settings):
    registration = _register(db, settings)
    later = START + timedelta(hours=2)
    rotated = accounts.refresh(db, refresh_token=registration.tokens.refresh_token, now=later, settings=settings)
    assert accounts.authenticate(db, access_token=rotated.access_token, now=later) == registration.user_id
    with pytest.raises(AuthError):
        accounts.refresh(db, refresh_token=registration.tokens.refresh_token, now=later, settings=settings)
    with pytest.raises(AuthError):
        accounts.authenticate(db, access_token=registration.tokens.access_token, now=START)


def test_login_with_account_key_issues_new_session(db, settings):
    registration = _register(db, settings)
    much_later = START + settings.refresh_token_ttl + timedelta(days=1)
    tokens = accounts.login(
        db, user_id=registration.user_id, account_key=registration.account_key, now=much_later, settings=settings
    )
    assert accounts.authenticate(db, access_token=tokens.access_token, now=much_later) == registration.user_id


def test_login_with_wrong_key_fails(db, settings):
    registration = _register(db, settings)
    with pytest.raises(AuthError):
        accounts.login(db, user_id=registration.user_id, account_key="ak_wrong", now=START, settings=settings)


def test_logout_revokes_session(db, settings):
    registration = _register(db, settings)
    accounts.logout(db, access_token=registration.tokens.access_token)
    with pytest.raises(AuthError):
        accounts.authenticate(db, access_token=registration.tokens.access_token, now=START)
