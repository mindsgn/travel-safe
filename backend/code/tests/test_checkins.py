from datetime import timedelta

from deadman.timeutil import to_db


def test_first_check_in_arms_the_switch(client, register, check_in, clock):
    account = register(interval=7)
    status = client.get("/api/v1/switch/status", headers=account.headers).json()
    assert status["state"] == "inactive"
    assert status["next_deadline_at"] is None

    body = check_in(account)
    assert body["created"] is True
    assert body["status"]["state"] == "armed"
    assert body["status"]["next_deadline_at"] == to_db(clock() + timedelta(days=7))


def test_check_in_is_idempotent_by_client_id(client, register, clock):
    account = register()
    payload = {"client_id": "offline-retry-1", "occurred_at": clock().isoformat()}
    first = client.post("/api/v1/check-ins", json=payload, headers=account.headers)
    clock.advance(minutes=10)
    second = client.post("/api/v1/check-ins", json=payload, headers=account.headers)
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["check_in"]["id"] == first.json()["check_in"]["id"]


def test_deadline_uses_server_time_not_device_clock(client, register, clock):
    account = register(interval=1)
    future_device_time = (clock() + timedelta(days=30)).isoformat()
    body = client.post(
        "/api/v1/check-ins",
        json={"client_id": "skewed-clock", "occurred_at": future_device_time},
        headers=account.headers,
    ).json()
    assert body["status"]["next_deadline_at"] == to_db(clock() + timedelta(days=1))
    assert body["check_in"]["occurred_at"] == to_db(clock())


def test_check_in_before_deadline_extends_it(client, register, check_in, clock, run_worker):
    account = register(interval=1)
    check_in(account)
    clock.advance(hours=23)
    body = check_in(account)
    assert body["status"]["next_deadline_at"] == to_db(clock() + timedelta(days=1))
    clock.advance(hours=2)
    assert run_worker().triggered_events == []


def test_check_in_exactly_at_deadline_is_on_time(client, register, check_in, clock, run_worker):
    account = register(interval=1)
    check_in(account)
    clock.advance(days=1)
    assert run_worker().triggered_events == []
    body = check_in(account)
    assert body["status"]["state"] == "armed"
    assert body["resolved_event_ids"] == []


def test_check_in_after_trigger_resolves_event(client, register, check_in, clock, run_worker):
    account = register(interval=1)
    check_in(account)
    clock.advance(days=1, seconds=1)
    [event_id] = run_worker().triggered_events
    clock.advance(minutes=5)
    body = check_in(account)
    assert body["resolved_event_ids"] == [event_id]
    assert body["status"]["state"] == "armed"
    event = client.get("/api/v1/switch/events/latest", headers=account.headers).json()["event"]
    assert event["status"] == "resolved"


def test_check_in_with_location_updates_last_known(client, register, check_in, clock):
    account = register()
    check_in(
        account,
        location={"latitude": -33.92, "longitude": 18.42, "accuracy_m": 12, "recorded_at": clock().isoformat()},
        device={"battery_level": 0.42, "low_power_mode": True},
    )
    last = client.get("/api/v1/locations/last", headers=account.headers).json()["last_known"]
    assert last["latitude"] == -33.92
    assert last["accuracy_m"] == 12


def test_latest_check_in_endpoint(client, register, check_in):
    account = register()
    assert client.get("/api/v1/check-ins/latest", headers=account.headers).json()["check_in"] is None
    created = check_in(account)["check_in"]
    latest = client.get("/api/v1/check-ins/latest", headers=account.headers).json()["check_in"]
    assert latest["id"] == created["id"]


def test_user_changes_interval_recomputes_deadline(client, register, check_in, clock):
    account = register(interval=1)
    check_in(account)
    last = clock()
    clock.advance(hours=6)
    response = client.patch("/api/v1/me", json={"check_in_interval_days": 30}, headers=account.headers)
    assert response.status_code == 200
    status = client.get("/api/v1/switch/deadline", headers=account.headers).json()
    assert status["next_deadline_at"] == to_db(last + timedelta(days=30))


def test_shortening_interval_into_the_past_is_rejected(client, register, check_in, clock):
    account = register(interval=30)
    check_in(account)
    clock.advance(days=5)
    response = client.patch("/api/v1/me", json={"check_in_interval_days": 3}, headers=account.headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "interval_would_expire"


def test_out_of_range_interval_is_rejected(client, register):
    assert client.post(
        "/api/v1/auth/register", json={"name": "A", "check_in_interval_days": 400}
    ).status_code == 422
    account = register()
    assert client.patch("/api/v1/me", json={"check_in_interval_days": 0}, headers=account.headers).status_code == 422


def test_naive_timestamps_are_rejected(client, register):
    account = register()
    response = client.post(
        "/api/v1/check-ins",
        json={"client_id": "naive-time", "occurred_at": "2026-01-10T09:00:00"},
        headers=account.headers,
    )
    assert response.status_code == 422
