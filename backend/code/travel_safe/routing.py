from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

import httpx

from travel_safe.geo import interpolate_lnglat, path_length_meters

Provider = Literal["mapbox", "osrm", "mock"]

OSRM_DRIVING_URL = "https://router.project-osrm.org/route/v1/driving"
MAPBOX_DRIVING_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"
USER_AGENT = "TravelSafe/1.0"


@dataclass(frozen=True)
class LatLng:
    latitude: float
    longitude: float
    label: str | None = None


@dataclass(frozen=True)
class Pathway:
    coordinates: list[tuple[float, float]]
    distance_meters: float
    duration_seconds: float
    provider: Provider


HttpGet = Callable[[str], dict]


def manhattan_road_pathway(origin: LatLng, destination: LatLng, steps_per_leg: int = 8) -> Pathway:
    """Build an L-shaped roadway approximation (never a two-point straight line)."""
    start = (origin.longitude, origin.latitude)
    end = (destination.longitude, destination.latitude)
    same_lat = abs(origin.latitude - destination.latitude) < 1e-5
    same_lng = abs(origin.longitude - destination.longitude) < 1e-5

    if same_lat or same_lng:
        bulge_lng = (origin.longitude + destination.longitude) / 2 + 0.004
        bulge_lat = (origin.latitude + destination.latitude) / 2 + 0.003
        corner = (bulge_lng, bulge_lat)
    else:
        corner = (destination.longitude, origin.latitude)

    first = interpolate_lnglat(start, corner, steps_per_leg)
    second = interpolate_lnglat(corner, end, steps_per_leg)
    coordinates = first + second[1:]
    distance = path_length_meters(coordinates)
    return Pathway(
        coordinates=coordinates,
        distance_meters=distance,
        duration_seconds=distance / 8.3,
        provider="mock",
    )


def parse_osrm_route(payload: dict, provider: Provider = "osrm") -> Pathway | None:
    if payload.get("code") not in (None, "Ok"):
        return None
    routes = payload.get("routes") or []
    if not routes:
        return None
    geometry = routes[0].get("geometry") or {}
    raw_coordinates = geometry.get("coordinates") or []
    coordinates: list[tuple[float, float]] = []
    for pair in raw_coordinates:
        if not isinstance(pair, list) or len(pair) < 2:
            continue
        lng, lat = pair[0], pair[1]
        if isinstance(lng, (int, float)) and isinstance(lat, (int, float)):
            coordinates.append((float(lng), float(lat)))
    if len(coordinates) < 3:
        return None
    distance = routes[0].get("distance")
    duration = routes[0].get("duration")
    return Pathway(
        coordinates=coordinates,
        distance_meters=float(distance) if isinstance(distance, (int, float)) else path_length_meters(coordinates),
        duration_seconds=float(duration) if isinstance(duration, (int, float)) else 0.0,
        provider=provider,
    )


def mapbox_access_token() -> str:
    return (
        os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()
        or os.environ.get("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "").strip()
    )


def fetch_mapbox_pathway(
    origin: LatLng,
    destination: LatLng,
    http_get: HttpGet | None = None,
    timeout_seconds: float = 12.0,
    token: str | None = None,
) -> Pathway | None:
    access_token = token if token is not None else mapbox_access_token()
    if not access_token:
        return None
    coordinates = f"{origin.longitude},{origin.latitude};{destination.longitude},{destination.latitude}"
    url = (
        f"{MAPBOX_DRIVING_URL}/{coordinates}"
        f"?geometries=geojson&overview=full&steps=false&access_token={access_token}"
    )
    getter = http_get or _default_http_get(timeout_seconds)
    try:
        payload = getter(url)
    except (httpx.HTTPError, ValueError, TypeError, OSError):
        return None
    if not isinstance(payload, dict):
        return None
    return parse_osrm_route(payload, provider="mapbox")


def fetch_osrm_pathway(
    origin: LatLng,
    destination: LatLng,
    http_get: HttpGet | None = None,
    timeout_seconds: float = 12.0,
) -> Pathway | None:
    url = (
        f"{OSRM_DRIVING_URL}/"
        f"{origin.longitude},{origin.latitude};{destination.longitude},{destination.latitude}"
        "?overview=full&geometries=geojson"
    )
    getter = http_get or _default_http_get(timeout_seconds)
    try:
        payload = getter(url)
    except (httpx.HTTPError, ValueError, TypeError, OSError):
        return None
    if not isinstance(payload, dict):
        return None
    return parse_osrm_route(payload, provider="osrm")


def plan_road_pathway(
    origin: LatLng,
    destination: LatLng,
    http_get: HttpGet | None = None,
) -> Pathway:
    mapbox = fetch_mapbox_pathway(origin, destination, http_get=http_get)
    if mapbox is not None:
        return mapbox
    osrm = fetch_osrm_pathway(origin, destination, http_get=http_get)
    if osrm is not None:
        return osrm
    return manhattan_road_pathway(origin, destination)


def _default_http_get(timeout_seconds: float) -> HttpGet:
    def getter(url: str) -> dict:
        response = httpx.get(
            url,
            timeout=timeout_seconds,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            follow_redirects=True,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise TypeError("Directions response was not an object")
        return payload

    return getter
