from __future__ import annotations

import logging
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

MAPBOX_REVERSE_URL = "https://api.mapbox.com/search/geocode/v6/reverse"


class ReverseGeocoder(Protocol):
    def reverse(self, latitude: float, longitude: float) -> str | None: ...


class NullGeocoder:
    def reverse(self, latitude: float, longitude: float) -> str | None:
        return None


class MapboxGeocoder:
    def __init__(self, token: str, client: httpx.Client | None = None) -> None:
        self._token = token
        self._client = client or httpx.Client(timeout=10)

    def reverse(self, latitude: float, longitude: float) -> str | None:
        try:
            response = self._client.get(
                MAPBOX_REVERSE_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "limit": 1,
                    "access_token": self._token,
                },
            )
            response.raise_for_status()
            features = response.json().get("features") or []
        except (httpx.HTTPError, ValueError) as error:
            logger.warning("Reverse geocoding failed: %s", type(error).__name__)
            return None
        if not features:
            return None
        properties = features[0].get("properties") or {}
        return properties.get("full_address") or properties.get("place_formatted") or properties.get("name")
