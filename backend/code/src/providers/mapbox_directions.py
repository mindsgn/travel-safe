from __future__ import annotations

import os

import httpx

from src.models.safety import Pathway, TripProfile

MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox"


class MapboxDirectionsError(Exception):
    pass


class MapboxDirectionsClient:
    def __init__(
        self,
        access_token: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.access_token = access_token if access_token is not None else os.getenv("MAPBOX_ACCESS_TOKEN", "")
        self._http = http_client

    def has_token(self) -> bool:
        return bool(self.access_token.strip())

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        profile: TripProfile,
    ) -> Pathway:
        if not self.has_token():
            raise MapboxDirectionsError("MAPBOX_ACCESS_TOKEN is not set")

        coordinates = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        url = f"{MAPBOX_DIRECTIONS_URL}/{profile}/{coordinates}"
        params = {
            "geometries": "geojson",
            "overview": "full",
            "steps": "false",
            "access_token": self.access_token,
        }

        client = self._http or httpx.Client(timeout=15.0)
        owns_client = self._http is None
        try:
            response = client.get(url, params=params)
        except httpx.HTTPError as exc:
            raise MapboxDirectionsError(str(exc)) from exc
        finally:
            if owns_client:
                client.close()

        if response.status_code >= 400:
            raise MapboxDirectionsError(f"Mapbox Directions failed with {response.status_code}")

        payload = response.json()
        routes = payload.get("routes") or []
        if not routes:
            raise MapboxDirectionsError("Mapbox Directions returned no routes")

        route = routes[0]
        geometry = route.get("geometry") or {}
        coordinates_lng_lat = geometry.get("coordinates") or []
        if len(coordinates_lng_lat) < 2:
            raise MapboxDirectionsError("Mapbox Directions geometry is incomplete")

        parsed: list[tuple[float, float]] = []
        for pair in coordinates_lng_lat:
            if not isinstance(pair, (list, tuple)) or len(pair) < 2:
                raise MapboxDirectionsError("Mapbox Directions coordinate is invalid")
            parsed.append((float(pair[0]), float(pair[1])))

        return Pathway(
            coordinates=parsed,
            distance_meters=float(route.get("distance") or 0),
            duration_seconds=float(route.get("duration") or 0),
            provider="mapbox",
        )
