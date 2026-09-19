from __future__ import annotations

import httpx

from src.models.safety import Pathway, TripProfile

OSRM_DRIVING_URL = "https://router.project-osrm.org/route/v1/driving"
OSRM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot"


class OsrmDirectionsError(Exception):
    pass


def osrm_endpoint_for_profile(profile: TripProfile) -> str:
    if profile == "walking":
        return OSRM_FOOT_URL
    return OSRM_DRIVING_URL


class OsrmDirectionsClient:
    def __init__(self, http_client: httpx.Client | None = None) -> None:
        self._http = http_client

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        profile: TripProfile,
    ) -> Pathway:
        coordinates = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        url = f"{osrm_endpoint_for_profile(profile)}/{coordinates}"
        params = {"overview": "full", "geometries": "geojson"}

        client = self._http or httpx.Client(timeout=20.0)
        owns_client = self._http is None
        try:
            response = client.get(url, params=params)
        except httpx.HTTPError as exc:
            raise OsrmDirectionsError(str(exc)) from exc
        finally:
            if owns_client:
                client.close()

        if response.status_code >= 400:
            raise OsrmDirectionsError(f"OSRM routing failed with {response.status_code}")

        payload = response.json()
        if str(payload.get("code") or "").lower() not in {"ok", ""}:
            raise OsrmDirectionsError(f"OSRM routing returned {payload.get('code')}")

        routes = payload.get("routes") or []
        if not routes:
            raise OsrmDirectionsError("OSRM returned no routes")

        route = routes[0]
        geometry = route.get("geometry") or {}
        coordinates_lng_lat = geometry.get("coordinates") or []
        if isinstance(geometry, str) or len(coordinates_lng_lat) < 2:
            raise OsrmDirectionsError("OSRM geometry is incomplete")

        parsed: list[tuple[float, float]] = []
        for pair in coordinates_lng_lat:
            if not isinstance(pair, (list, tuple)) or len(pair) < 2:
                raise OsrmDirectionsError("OSRM coordinate is invalid")
            parsed.append((float(pair[0]), float(pair[1])))

        return Pathway(
            coordinates=parsed,
            distance_meters=float(route.get("distance") or 0),
            duration_seconds=float(route.get("duration") or 0),
            provider="osrm",
        )
