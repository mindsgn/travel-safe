import pytest

PROTECTED = [
    ("get", "/api/v1/me"),
    ("patch", "/api/v1/me"),
    ("delete", "/api/v1/me"),
    ("post", "/api/v1/auth/logout"),
    ("post", "/api/v1/check-ins"),
    ("get", "/api/v1/check-ins/latest"),
    ("get", "/api/v1/check-ins/status"),
    ("get", "/api/v1/contacts"),
    ("post", "/api/v1/contacts"),
    ("get", "/api/v1/contacts/abc"),
    ("put", "/api/v1/contacts/abc"),
    ("delete", "/api/v1/contacts/abc"),
    ("post", "/api/v1/locations"),
    ("get", "/api/v1/locations/last"),
    ("get", "/api/v1/switch/status"),
    ("get", "/api/v1/switch/deadline"),
    ("get", "/api/v1/switch/events/latest"),
]


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_user_endpoints_require_authentication(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_user_endpoints_reject_bad_tokens(client, method, path):
    response = getattr(client, method)(path, headers={"Authorization": "Bearer at_forged"})
    assert response.status_code == 401


def test_register_refresh_logout_flow(client, register, clock):
    account = register()
    assert client.get("/api/v1/me", headers=account.headers).json()["name"] == "Thandi"

    clock.advance(days=3651)
    assert client.get("/api/v1/me", headers=account.headers).status_code == 401
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": account.refresh_token})
    assert refreshed.status_code == 200
    headers = {"Authorization": f"Bearer {refreshed.json()['access_token']}"}
    assert client.get("/api/v1/me", headers=headers).status_code == 200

    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/me", headers=headers).status_code == 401

    login = client.post("/api/v1/auth/login", json={"user_id": account.user_id, "account_key": account.account_key})
    assert login.status_code == 200


def test_profile_update(client, register):
    account = register()
    response = client.patch("/api/v1/me", json={"name": "  Thandi M  ", "timezone": "Europe/London"}, headers=account.headers)
    assert response.json()["name"] == "Thandi M"
    assert response.json()["timezone"] == "Europe/London"
    assert client.patch("/api/v1/me", json={"name": "   "}, headers=account.headers).status_code == 422


def test_status_reports_contact_count_and_server_time(client, register, add_contact, check_in):
    account = register()
    add_contact(account)
    check_in(account)
    status = client.get("/api/v1/switch/status", headers=account.headers).json()
    assert status["contact_count"] == 1
    assert status["seconds_remaining"] == 86400
    assert status["deadline_passed"] is False
    assert status["latest_event"] is None
    assert status["server_time"].endswith("Z")


def test_location_batch_limits(client, register, clock):
    account = register()
    point = {"latitude": 0, "longitude": 0, "recorded_at": clock().isoformat()}
    too_many = client.post("/api/v1/locations", json={"points": [point] * 101}, headers=account.headers)
    assert too_many.status_code == 422
    bad = client.post(
        "/api/v1/locations", json={"points": [{**point, "latitude": 91}]}, headers=account.headers
    )
    assert bad.status_code == 422
