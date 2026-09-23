from deadman.security import twilio_signature, verify_twilio_signature

CALLBACK_URL = "https://safe.example/webhooks/twilio/status"


def test_signature_roundtrip():
    params = {"MessageSid": "SM1", "MessageStatus": "delivered"}
    signature = twilio_signature("secret", CALLBACK_URL, params)
    assert verify_twilio_signature("secret", CALLBACK_URL, params, signature)
    assert not verify_twilio_signature("other", CALLBACK_URL, params, signature)
    assert not verify_twilio_signature("secret", CALLBACK_URL, params, None)


def test_webhook_rejects_unsigned_requests(client):
    response = client.post(
        "/webhooks/twilio/status",
        content="MessageSid=SM1&MessageStatus=delivered",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 403


def test_webhook_applies_signed_status(client, db, register, check_in, add_contact, clock, run_worker):
    account = register()
    add_contact(account, email=None, phone="+27821234567", whatsapp=True)
    check_in(account)
    clock.advance(days=1, seconds=1)
    run_worker()

    params = {"MessageSid": "SMwa", "MessageStatus": "delivered"}
    response = client.post(
        "/webhooks/twilio/status",
        content="MessageSid=SMwa&MessageStatus=delivered",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Twilio-Signature": twilio_signature("twilio-secret", CALLBACK_URL, params),
        },
    )
    assert response.status_code == 204
    assert db.execute("SELECT status FROM notification_events").fetchone()[0] == "delivered"
