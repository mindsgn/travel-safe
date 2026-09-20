"""South African geography reference. Unknown names stay unmatched."""

from __future__ import annotations

PROVINCES = {
    "western cape": "Western Cape",
    "eastern cape": "Eastern Cape",
    "northern cape": "Northern Cape",
    "free state": "Free State",
    "kwazulu-natal": "KwaZulu-Natal",
    "kwazulu natal": "KwaZulu-Natal",
    "kzn": "KwaZulu-Natal",
    "north west": "North West",
    "gauteng": "Gauteng",
    "mpumalanga": "Mpumalanga",
    "limpopo": "Limpopo",
}

# suburb/city lookup used only when the string is a known place.
PLACES: dict[str, dict[str, str]] = {
    "khayelitsha": {
        "suburb": "Khayelitsha",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "nyanga": {
        "suburb": "Nyanga",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "mitchells plain": {
        "suburb": "Mitchells Plain",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "bellville": {
        "suburb": "Bellville",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "delft": {
        "suburb": "Delft",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "mfuleni": {
        "suburb": "Mfuleni",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "parow": {
        "suburb": "Parow",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "gugulethu": {
        "suburb": "Gugulethu",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "bonteheuwel": {
        "suburb": "Bonteheuwel",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "plumstead": {
        "suburb": "Plumstead",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "philippi": {
        "suburb": "Philippi",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "athlone": {
        "suburb": "Athlone",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "kraaifontein": {
        "suburb": "Kraaifontein",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "makhaza": {
        "suburb": "Makhaza",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "samora machel": {
        "suburb": "Samora Machel",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "klapmuts": {
        "suburb": "Klapmuts",
        "city": "Stellenbosch",
        "municipality": "Stellenbosch",
        "province": "Western Cape",
        "precision": "suburb",
    },
    "stellenbosch": {
        "suburb": "Stellenbosch",
        "city": "Stellenbosch",
        "municipality": "Stellenbosch",
        "province": "Western Cape",
        "precision": "city",
    },
    "paarl": {
        "suburb": "Paarl",
        "city": "Paarl",
        "municipality": "Drakenstein",
        "province": "Western Cape",
        "precision": "city",
    },
    "cape town": {
        "suburb": "",
        "city": "Cape Town",
        "municipality": "City of Cape Town",
        "province": "Western Cape",
        "precision": "city",
    },
    "western cape": {
        "suburb": "",
        "city": "",
        "municipality": "",
        "province": "Western Cape",
        "precision": "province",
    },
}


def normalize_province(name: str | None) -> str | None:
    if not name:
        return None
    return PROVINCES.get(name.strip().lower())


def is_valid_province(name: str | None) -> bool:
    if name is None:
        return True
    return normalize_province(name) == name or name in PROVINCES.values()
