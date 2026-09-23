from deadman.notifications.dispatcher import apply_delivery_status
from deadman.notifications.providers import NOT_CONFIGURED, SendResult


def _trigger(register, check_in, add_contact, clock, run_worker, **contact):
    account = register()
    add_contact(account, **contact)
    check_in(account)
    clock.advance(days=1, seconds=1)
    run_worker()
    return account


def _notification(db):
    return db.execute("SELECT * FROM notification_events").fetchone()


def test_notification_success_records_provider_id_and_link(db, register, check_in, add_contact, clock, run_worker, email):
    _trigger(register, check_in, add_contact, clock, run_worker)
    row = _notification(db)
    assert row["status"] == "sent"
    assert row["provider_message_id"] == "email-1"
    assert row["sent_at"] is not None
    assert row["attempts"] == 1
    [sent] = email.sent
    assert "https://safe.example/e/" in sent["text"]
    assert sent["idempotency_key"] == f"{row['id']}-1"
    assert db.execute("SELECT COUNT(*) FROM emergency_links").fetchone()[0] == 1


def test_retryable_failure_is_retried_until_max_attempts(db, register, check_in, add_contact, clock, run_worker, email, settings):
    email.result = SendResult(ok=False, error="http_503", retryable=True)
    _trigger(register, check_in, add_contact, clock, run_worker)
    for _ in range(5):
        clock.advance(minutes=1)
        run_worker()
    row = _notification(db)
    assert row["status"] == "failed"
    assert row["failure_reason"] == "http_503"
    assert row["attempts"] == settings.notification_max_attempts
    assert len(email.sent) == settings.notification_max_attempts


def test_failure_then_success_on_retry(db, register, check_in, add_contact, clock, run_worker, email):
    email.result = SendResult(ok=False, error="ConnectError", retryable=True)
    _trigger(register, check_in, add_contact, clock, run_worker)
    email.result = SendResult(ok=True, provider_message_id="email-2")
    clock.advance(minutes=1)
    run_worker()
    row = _notification(db)
    assert row["status"] == "sent"
    assert row["failure_reason"] is None
    assert row["attempts"] == 2


def test_unconfigured_channel_fails_visibly_and_is_not_retried(db, register, check_in, add_contact, clock, run_worker, messaging):
    messaging.sms_result = NOT_CONFIGURED
    _trigger(register, check_in, add_contact, clock, run_worker, email=None, phone="+27821234567")
    clock.advance(minutes=1)
    run_worker()
    row = _notification(db)
    assert row["status"] == "failed"
    assert row["failure_reason"] == "channel_not_configured"
    assert row["retryable"] == 0
    assert len(messaging.sms) == 1


def test_whatsapp_failure_is_not_marked_successful(db, client, register, check_in, add_contact, clock, run_worker, messaging):
    messaging.whatsapp_result = SendResult(ok=False, error="http_400", retryable=False)
    account = _trigger(
        register, check_in, add_contact, clock, run_worker, email=None, phone="+27821234567", whatsapp=True
    )
    row = _notification(db)
    assert row["channel"] == "whatsapp"
    assert row["status"] == "failed"
    event = client.get("/api/v1/switch/events/latest", headers=account.headers).json()["event"]
    assert event["notifications"][0]["status"] == "failed"
    assert event["notifications"][0]["failure_reason"] == "http_400"


def test_provider_exception_is_recorded_as_failure(db, register, check_in, add_contact, clock, run_worker, email):
    def explode(**_kwargs):
        raise RuntimeError("boom")

    email.send_email = explode
    _trigger(register, check_in, add_contact, clock, run_worker)
    row = _notification(db)
    assert row["status"] == "failed"
    assert row["failure_reason"] == "provider_error:RuntimeError"


def test_pending_notifications_cancelled_when_user_checks_in(db, settings, register, check_in, add_contact, clock, email):
    from deadman.engine import process_expired
    from deadman.geocoding import NullGeocoder

    account = register()
    add_contact(account)
    check_in(account)
    clock.advance(days=1, seconds=1)
    process_expired(db, clock(), settings, NullGeocoder())
    assert _notification(db)["status"] == "pending"
    check_in(account)
    assert _notification(db)["status"] == "cancelled"
    assert email.sent == []


def test_delivery_callback_updates_status(db, register, check_in, add_contact, clock, run_worker, messaging):
    _trigger(register, check_in, add_contact, clock, run_worker, email=None, phone="+27821234567", whatsapp=True)
    assert apply_delivery_status(db, "SMwa", "delivered", None, clock())
    assert _notification(db)["status"] == "delivered"
    assert not apply_delivery_status(db, "SMwa", "undelivered", "63016", clock())
    assert _notification(db)["status"] == "delivered"


def test_delivery_failure_callback_marks_failed(db, register, check_in, add_contact, clock, run_worker):
    _trigger(register, check_in, add_contact, clock, run_worker, email=None, phone="+27821234567")
    assert apply_delivery_status(db, "SMsms", "undelivered", "30003", clock())
    row = _notification(db)
    assert row["status"] == "failed"
    assert row["failure_reason"] == "delivery_failed:30003"
    assert apply_delivery_status(db, "SMsms", "queued", None, clock()) is False
