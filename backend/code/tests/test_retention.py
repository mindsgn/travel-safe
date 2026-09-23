from datetime import timedelta

from deadman.retention import cleanup_links, cleanup_locations, purge_archived_profiles, run_cleanup


def _upload(client, account, recorded_at, source="foreground"):
    response = client.post(
        "/api/v1/locations",
        json={"source": source, "points": [{"latitude": -33.9, "longitude": 18.4, "recorded_at": recorded_at.isoformat()}]},
        headers=account.headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_location_older_than_24_hours_is_removed(db, client, register, clock, settings):
    account = register()
    _upload(client, account, clock())
    clock.advance(hours=23)
    assert cleanup_locations(db, clock(), settings) == 0
    clock.advance(hours=1, seconds=1)
    assert cleanup_locations(db, clock(), settings) == 1
    assert db.execute("SELECT COUNT(*) FROM locations").fetchone()[0] == 0


def test_last_known_location_survives_journey_cleanup(db, client, register, clock, settings):
    account = register()
    _upload(client, account, clock())
    clock.advance(days=3)
    run_cleanup(db, clock(), settings)
    assert client.get("/api/v1/locations/last", headers=account.headers).json()["last_known"] is not None


def test_points_already_older_than_retention_are_not_stored(client, register, clock):
    account = register()
    body = _upload(client, account, clock() - timedelta(hours=30))
    assert body["stored"] == 0
    assert body["last_known"] is not None


def test_emergency_location_retained_then_purged(db, client, register, check_in, clock, run_worker, settings):
    account = register()
    check_in(account)
    clock.advance(hours=23)
    _upload(client, account, clock(), source="background")
    clock.advance(hours=1, seconds=1)
    [event_id] = run_worker().triggered_events

    clock.advance(days=2)
    run_cleanup(db, clock(), settings)
    assert db.execute("SELECT COUNT(*) FROM locations WHERE deadman_event_id = ?", (event_id,)).fetchone()[0] == 1
    assert db.execute("SELECT latitude FROM deadman_events WHERE id = ?", (event_id,)).fetchone()[0] is not None

    clock.advance(days=settings.emergency_link_ttl.days)
    summary = run_cleanup(db, clock(), settings)
    assert summary.locations_deleted == 1
    assert summary.events_scrubbed == 1
    event = db.execute("SELECT latitude, address, location_scrubbed_at FROM deadman_events WHERE id = ?", (event_id,)).fetchone()
    assert event["latitude"] is None and event["location_scrubbed_at"] is not None


def test_generated_link_expires(db, client, register, check_in, add_contact, clock, run_worker, email, settings):
    account = register()
    add_contact(account)
    check_in(account)
    clock.advance(days=1, seconds=1)
    run_worker()
    url = email.sent[0]["text"].split("More details and a map: ")[1].split("\n")[0]
    path = url.replace("https://safe.example", "")
    assert client.get(path).status_code == 200

    clock.advance(days=settings.emergency_link_ttl.days)
    assert client.get(path).status_code == 404
    assert cleanup_links(db, clock()) == 1
    assert client.get(path).status_code == 404


def test_user_deletes_profile_archives_and_scrubs_location(db, client, register, check_in, add_contact, clock, settings):
    account = register()
    add_contact(account)
    check_in(account, location={"latitude": 1.0, "longitude": 2.0, "recorded_at": clock().isoformat()})
    response = client.delete("/api/v1/me", headers=account.headers)
    assert response.status_code == 200
    assert response.json()["archived"] is True

    assert client.get("/api/v1/me", headers=account.headers).status_code == 401
    user = db.execute("SELECT switch_state, archived_at FROM users WHERE id = ?", (account.user_id,)).fetchone()
    assert user["switch_state"] == "archived"
    assert db.execute("SELECT COUNT(*) FROM last_known_locations").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM locations").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM archived_profiles").fetchone()[0] == 1
    login = client.post("/api/v1/auth/login", json={"user_id": account.user_id, "account_key": account.account_key})
    assert login.status_code == 401


def test_archived_profile_purged_after_three_months(db, client, register, add_contact, check_in, clock):
    account = register()
    add_contact(account)
    check_in(account)
    client.delete("/api/v1/me", headers=account.headers)

    clock.advance(days=89)
    assert purge_archived_profiles(db, clock()) == 0
    clock.advance(days=1)
    assert purge_archived_profiles(db, clock()) == 1
    for table in ("users", "emergency_contacts", "check_ins", "archived_profiles"):
        assert db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
    assert purge_archived_profiles(db, clock()) == 0


def test_cleanup_is_safe_to_run_repeatedly(db, clock, settings):
    first = run_cleanup(db, clock(), settings)
    second = run_cleanup(db, clock(), settings)
    assert first == second
