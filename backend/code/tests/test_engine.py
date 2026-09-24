from deadman.engine import channels_for_contact, find_expired_users, trigger_user
from tests.conftest import FixedGeocoder


def _expire(register, check_in, clock, interval=1):
    account = register(interval=interval)
    check_in(account)
    clock.advance(days=interval, seconds=1)
    return account


def test_channels_for_contact():
    assert channels_for_contact("a@example.com", None) == ["email"]
    assert channels_for_contact(None, "+27821234567") == ["whatsapp"]
    assert channels_for_contact("a@example.com", "+27821234567") == ["email", "whatsapp"]


def test_inactive_user_never_triggers(register, clock, run_worker):
    register(interval=1)
    clock.advance(days=400)
    assert run_worker().triggered_events == []


def test_missed_deadline_triggers_switch(client, register, check_in, add_contact, clock, run_worker):
    account = register()
    add_contact(account)
    check_in(account)
    clock.advance(days=1, seconds=1)
    report = run_worker()
    assert len(report.triggered_events) == 1
    status = client.get("/api/v1/switch/status", headers=account.headers).json()
    assert status["state"] == "triggered"
    assert status["latest_event"]["status"] == "triggered"
    assert status["latest_event"]["notifications"][0]["status"] == "sent"


def test_switch_cannot_trigger_twice(db, settings, register, check_in, clock):
    account = _expire(register, check_in, clock)
    assert find_expired_users(db, clock()) == [account.user_id]
    first = trigger_user(db, account.user_id, clock(), settings)
    second = trigger_user(db, account.user_id, clock(), settings)
    assert first is not None
    assert second is None
    assert db.execute("SELECT COUNT(*) FROM deadman_events").fetchone()[0] == 1
    assert find_expired_users(db, clock()) == []


def test_worker_runs_repeatedly_without_duplicates(db, register, check_in, add_contact, clock, run_worker, email):
    account = register()
    add_contact(account)
    check_in(account)
    clock.advance(days=1, seconds=1)
    for _ in range(5):
        run_worker()
        clock.advance(minutes=1)
    assert db.execute("SELECT COUNT(*) FROM deadman_events").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM notification_events").fetchone()[0] == 1
    assert len(email.sent) == 1


def test_multiple_contacts_each_get_their_channels(db, register, check_in, add_contact, clock, run_worker, email, messaging):
    account = register()
    add_contact(account, name="Email only", email="e@example.com")
    add_contact(account, name="Phone only", email=None, phone="+27820000001")
    add_contact(account, name="Both", email="b@example.com", phone="+27820000002", whatsapp=True)
    check_in(account)
    clock.advance(days=1, seconds=1)
    run_worker()
    assert sorted(item["to"] for item in email.sent) == ["b@example.com", "e@example.com"]
    assert [item["to"] for item in messaging.whatsapp] == ["+27820000001", "+27820000002"]
    statuses = {row["status"] for row in db.execute("SELECT status FROM notification_events")}
    assert statuses == {"sent"}


def test_no_emergency_contacts_still_records_event(client, register, check_in, clock, run_worker):
    account = _expire(register, check_in, clock)
    report = run_worker()
    assert len(report.triggered_events) == 1
    event = client.get("/api/v1/switch/events/latest", headers=account.headers).json()["event"]
    assert event["status"] == "triggered"
    assert event["notifications"] == []


def test_trigger_snapshots_location_and_address(db, register, check_in, clock, run_worker):
    account = register()
    check_in(
        account,
        location={"latitude": -33.92, "longitude": 18.42, "accuracy_m": 8, "recorded_at": clock().isoformat()},
        device={"battery_level": 0.15},
    )
    clock.advance(days=1, seconds=1)
    geocoder = FixedGeocoder()
    [event_id] = run_worker(geocoder).triggered_events
    event = db.execute("SELECT * FROM deadman_events WHERE id = ?", (event_id,)).fetchone()
    assert (event["latitude"], event["longitude"]) == (-33.92, 18.42)
    assert event["address"] == "12 Long Street, Cape Town"
    assert event["battery_level"] == 0.15
    assert geocoder.calls == 1
    assert account.user_id == event["user_id"]


def test_trigger_tags_recent_journey_points(db, client, register, check_in, clock, run_worker):
    account = register()
    check_in(account)
    clock.advance(hours=20)
    client.post(
        "/api/v1/locations",
        json={
            "source": "background",
            "points": [{"latitude": -33.9, "longitude": 18.4, "recorded_at": clock().isoformat()}],
        },
        headers=account.headers,
    )
    clock.advance(hours=4, seconds=1)
    [event_id] = run_worker().triggered_events
    tagged = db.execute("SELECT COUNT(*) FROM locations WHERE deadman_event_id = ?", (event_id,)).fetchone()[0]
    assert tagged == 1


def test_archived_user_is_never_triggered(client, register, check_in, clock, run_worker):
    account = register()
    check_in(account)
    assert client.delete("/api/v1/me", headers=account.headers).status_code == 200
    clock.advance(days=2)
    assert run_worker().triggered_events == []
