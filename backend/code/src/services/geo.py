from __future__ import annotations

import hashlib
import math
from itertools import pairwise

EARTH_RADIUS_METERS = 6_371_000
MIN_PAD_METERS = 500.0
PAD_FRACTION = 0.15
SAME_POINT_METERS = 15.0
METERS_PER_DEGREE_LAT = 110_540.0


def to_radians(degrees: float) -> float:
    return (degrees * math.pi) / 180.0


def haversine_meters(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> float:
    d_lat = to_radians(dest_lat - origin_lat)
    d_lng = to_radians(dest_lng - origin_lng)
    lat1 = to_radians(origin_lat)
    lat2 = to_radians(dest_lat)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(min(1.0, h)))


def points_are_the_same(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    threshold_meters: float = SAME_POINT_METERS,
) -> bool:
    return haversine_meters(origin_lat, origin_lng, dest_lat, dest_lng) < threshold_meters


def pad_bbox(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    pad_fraction: float = PAD_FRACTION,
    min_pad_meters: float = MIN_PAD_METERS,
) -> tuple[float, float, float, float]:
    west = min(origin_lng, dest_lng)
    east = max(origin_lng, dest_lng)
    south = min(origin_lat, dest_lat)
    north = max(origin_lat, dest_lat)

    distance = haversine_meters(origin_lat, origin_lng, dest_lat, dest_lng)
    pad_meters = max(min_pad_meters, distance * pad_fraction)
    pad_lat = pad_meters / METERS_PER_DEGREE_LAT
    mid_lat = (south + north) / 2
    cos_lat = max(0.01, math.cos(to_radians(mid_lat)))
    pad_lng = pad_meters / (METERS_PER_DEGREE_LAT * cos_lat)

    return (
        max(-180.0, west - pad_lng),
        max(-90.0, south - pad_lat),
        min(180.0, east + pad_lng),
        min(90.0, north + pad_lat),
    )


def pad_bbox_from_coordinates(
    coordinates: list[tuple[float, float]],
    pad_fraction: float = PAD_FRACTION,
    min_pad_meters: float = MIN_PAD_METERS,
) -> tuple[float, float, float, float]:
    if len(coordinates) < 2:
        raise ValueError("coordinates must include at least two points")
    origin_lng, origin_lat = coordinates[0]
    dest_lng, dest_lat = coordinates[-1]
    west = min(point[0] for point in coordinates)
    east = max(point[0] for point in coordinates)
    south = min(point[1] for point in coordinates)
    north = max(point[1] for point in coordinates)
    distance = max(
        haversine_meters(origin_lat, origin_lng, dest_lat, dest_lng),
        haversine_meters(south, west, north, east),
    )
    pad_meters = max(min_pad_meters, distance * pad_fraction)
    pad_lat = pad_meters / METERS_PER_DEGREE_LAT
    mid_lat = (south + north) / 2
    cos_lat = max(0.01, math.cos(to_radians(mid_lat)))
    pad_lng = pad_meters / (METERS_PER_DEGREE_LAT * cos_lat)
    return (
        max(-180.0, west - pad_lng),
        max(-90.0, south - pad_lat),
        min(180.0, east + pad_lng),
        min(90.0, north + pad_lat),
    )


def interpolate(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def mock_pathway_coordinates(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    steps: int = 8,
) -> list[tuple[float, float]]:
    count = max(2, steps)
    dx = dest_lng - origin_lng
    dy = dest_lat - origin_lat
    length = math.hypot(dx, dy) or 1.0
    offset_scale = length * 0.08
    nx = -dy / length
    ny = dx / length

    seed = hashlib.md5(f"{origin_lat:.5f}:{origin_lng:.5f}:{dest_lat:.5f}:{dest_lng:.5f}".encode()).digest()
    bump = (seed[0] / 255.0) * 2 - 1

    points: list[tuple[float, float]] = []
    for index in range(count):
        t = index / (count - 1)
        lat = interpolate(origin_lat, dest_lat, t)
        lng = interpolate(origin_lng, dest_lng, t)
        arch = math.sin(math.pi * t) * offset_scale * bump
        points.append((lng + nx * arch, lat + ny * arch))
    return points


def pathway_distance_meters(coordinates: list[tuple[float, float]]) -> float:
    total = 0.0
    for previous, current in pairwise(coordinates):
        total += haversine_meters(previous[1], previous[0], current[1], current[0])
    return total


def mock_duration_seconds(distance_meters: float, profile: str) -> float:
    meters_per_second = 1.4 if profile == "walking" else 8.3
    return distance_meters / meters_per_second


def cell_relative_intensity(latitude: float, longitude: float) -> float:
    digest = hashlib.md5(f"{round(latitude, 4)}:{round(longitude, 4)}".encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def heatmap_grid_points(
    bbox: tuple[float, float, float, float],
    columns: int = 12,
    rows: int = 12,
) -> list[tuple[float, float]]:
    west, south, east, north = bbox
    points: list[tuple[float, float]] = []
    for row in range(rows):
        lat_t = (row + 0.5) / rows
        latitude = interpolate(south, north, lat_t)
        for column in range(columns):
            lng_t = (column + 0.5) / columns
            longitude = interpolate(west, east, lng_t)
            points.append((latitude, longitude))
    return points


def point_in_bbox(
    latitude: float,
    longitude: float,
    bbox: tuple[float, float, float, float],
) -> bool:
    west, south, east, north = bbox
    return west <= longitude <= east and south <= latitude <= north


def points_along_pathway(
    coordinates: list[tuple[float, float]],
    samples_per_segment: int = 4,
    offset_degrees: float = 0.003,
) -> list[tuple[float, float]]:
    if len(coordinates) < 2:
        return []

    points: list[tuple[float, float]] = []
    for previous, current in pairwise(coordinates):
        dx = current[0] - previous[0]
        dy = current[1] - previous[1]
        length = math.hypot(dx, dy) or 1.0
        nx = -dy / length * offset_degrees
        ny = dx / length * offset_degrees
        steps = max(1, samples_per_segment)
        for step in range(steps + 1):
            t = step / steps
            lng = interpolate(previous[0], current[0], t)
            lat = interpolate(previous[1], current[1], t)
            points.append((lat, lng))
            points.append((lat + ny, lng + nx))
            points.append((lat - ny, lng - nx))
    return points
