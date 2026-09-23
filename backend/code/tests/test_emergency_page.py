def _trigger_with_link(client, register, check_in, add_contact, clock, run_worker, email):
    account = register(name="Thandi <script>")
    add_contact(account)
    check_in(
        account,
        location={"latitude": -33.92, "longitude": 18.42, "accuracy_m": 10, "recorded_at": clock().isoformat()},
    )
    clock.advance(days=1, seconds=1)
    run_worker()
    url = email.sent[0]["text"].split("More details and a map: ")[1].split("\n")[0]
    return account, url.replace("https://safe.example", "")


def test_emergency_page_shows_user_information(client, register, check_in, add_contact, clock, run_worker, email):
    account, path = _trigger_with_link(client, register, check_in, add_contact, clock, run_worker, email)
    response = client.get(path)
    assert response.status_code == 200
    html = response.text
    assert "Thandi &lt;script&gt;" in html
    assert "<script>" not in html.split("<body>")[1].split("<link")[0]
    assert "-33.92000, 18.42000" in html
    assert "mapbox-gl" in html
    assert account.user_id not in html
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_emergency_json_excludes_internal_ids_and_contacts(client, register, check_in, add_contact, clock, run_worker, email):
    account, path = _trigger_with_link(client, register, check_in, add_contact, clock, run_worker, email)
    token = path.rsplit("/", 1)[1]
    body = client.get(f"/api/v1/emergency/{token}").json()
    assert body["user_name"] == "Thandi <script>"
    assert body["location"]["latitude"] == -33.92
    serialized = str(body)
    assert account.user_id not in serialized
    assert "sipho@example.com" not in serialized


def test_resolved_event_page_says_user_checked_in(client, register, check_in, add_contact, clock, run_worker, email):
    account, path = _trigger_with_link(client, register, check_in, add_contact, clock, run_worker, email)
    check_in(account)
    assert "has checked in again" in client.get(path).text


def test_unknown_token_returns_unavailable_page(client):
    response = client.get("/e/not-a-real-token")
    assert response.status_code == 404
    assert "no longer available" in response.text


def test_link_revoked_when_profile_archived(client, register, check_in, add_contact, clock, run_worker, email):
    account, path = _trigger_with_link(client, register, check_in, add_contact, clock, run_worker, email)
    client.delete("/api/v1/me", headers=account.headers)
    assert client.get(path).status_code == 404


def test_links_are_unique_per_notification(db, client, register, check_in, add_contact, clock, run_worker, email):
    account = register()
    add_contact(account, name="A", email="a@example.com")
    add_contact(account, name="B", email="b@example.com")
    check_in(account)
    clock.advance(days=1, seconds=1)
    run_worker()
    urls = {item["text"].split("More details and a map: ")[1].split("\n")[0] for item in email.sent}
    assert len(urls) == 2
    stored = [row[0] for row in db.execute("SELECT token_hash FROM emergency_links")]
    assert all(url.rsplit("/", 1)[1] not in stored for url in urls)
