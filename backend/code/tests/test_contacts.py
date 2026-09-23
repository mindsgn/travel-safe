import pytest

from deadman.contacts import normalize_phone, validate_contact
from deadman.errors import ValidationFailed


def test_contact_with_email_only_is_valid():
    contact = validate_contact(" Sipho ", "Sipho@Example.com ", None, False)
    assert (contact.name, contact.email, contact.phone) == ("Sipho", "sipho@example.com", None)


def test_contact_with_phone_only_is_valid():
    contact = validate_contact("Sipho", None, "+27 82 123 4567", False)
    assert contact.phone == "+27821234567"
    assert contact.email is None


def test_contact_with_both_is_valid():
    contact = validate_contact("Sipho", "s@example.com", "+27821234567", True)
    assert contact.email and contact.phone and contact.whatsapp


def test_international_prefix_00_is_normalized():
    assert normalize_phone("0044 20 7946 0958") == "+442079460958"


@pytest.mark.parametrize(
    ("name", "email", "phone", "whatsapp", "code"),
    [
        ("", "s@example.com", None, False, "missing_name"),
        ("Sipho", None, None, False, "missing_channel"),
        ("Sipho", "", "  ", False, "missing_channel"),
        ("Sipho", "not-an-email", None, False, "invalid_email"),
        ("Sipho", None, "0821234567", False, "invalid_phone"),
        ("Sipho", None, "+12", False, "invalid_phone"),
        ("Sipho", "s@example.com", None, True, "whatsapp_requires_phone"),
        ("x" * 101, "s@example.com", None, False, "name_too_long"),
    ],
)
def test_invalid_contacts_are_rejected(name, email, phone, whatsapp, code):
    with pytest.raises(ValidationFailed) as error:
        validate_contact(name, email, phone, whatsapp)
    assert error.value.code == code


def test_contact_crud_via_api(client, register):
    account = register()
    created = client.post(
        "/api/v1/contacts",
        json={"name": "Sipho", "phone": "+27821234567", "whatsapp": True},
        headers=account.headers,
    )
    assert created.status_code == 201
    contact_id = created.json()["id"]

    updated = client.put(
        f"/api/v1/contacts/{contact_id}",
        json={"name": "Sipho M", "email": "sipho@example.com", "phone": "+27821234567", "whatsapp": False},
        headers=account.headers,
    )
    assert updated.status_code == 200
    assert updated.json()["whatsapp"] is False
    assert updated.json()["email"] == "sipho@example.com"

    listed = client.get("/api/v1/contacts", headers=account.headers).json()["contacts"]
    assert [contact["name"] for contact in listed] == ["Sipho M"]

    assert client.delete(f"/api/v1/contacts/{contact_id}", headers=account.headers).status_code == 204
    assert client.get("/api/v1/contacts", headers=account.headers).json()["contacts"] == []


def test_multiple_contacts_allowed_but_duplicates_rejected(client, register, add_contact):
    account = register()
    add_contact(account, name="A", email="a@example.com")
    add_contact(account, name="B", email=None, phone="+27821230000")
    duplicate = client.post(
        "/api/v1/contacts", json={"name": "A again", "email": "A@example.com"}, headers=account.headers
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_contact"


def test_invalid_contact_returns_field_error(client, register):
    account = register()
    response = client.post("/api/v1/contacts", json={"name": "Sipho", "email": "nope"}, headers=account.headers)
    assert response.status_code == 422
    assert response.json()["error"] == {
        "code": "invalid_email",
        "message": "Enter a valid email address.",
        "field": "email",
    }


def test_contact_limit_is_enforced(client, register, add_contact, settings):
    account = register()
    for index in range(settings.max_contacts_per_user):
        add_contact(account, name=f"C{index}", email=f"c{index}@example.com")
    response = client.post(
        "/api/v1/contacts", json={"name": "One more", "email": "more@example.com"}, headers=account.headers
    )
    assert response.status_code == 409


def test_users_cannot_access_each_others_contacts(client, register, add_contact):
    owner = register("Owner")
    intruder = register("Intruder")
    contact = add_contact(owner)
    assert client.get(f"/api/v1/contacts/{contact['id']}", headers=intruder.headers).status_code == 404
    assert client.delete(f"/api/v1/contacts/{contact['id']}", headers=intruder.headers).status_code == 404
    assert client.get("/api/v1/contacts", headers=intruder.headers).json()["contacts"] == []
