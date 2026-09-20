from __future__ import annotations

import math
from itertools import pairwise

EARTH_RADIUS_METERS = 6_371_000.0


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(a))


def interpolate_lnglat(
    start: tuple[float, float],
    end: tuple[float, float],
    steps: int,
) -> list[tuple[float, float]]:
    if steps < 1:
        return [start, end]
    points: list[tuple[float, float]] = []
    for index in range(steps + 1):
        t = index / steps
        points.append((start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t))
    return points


def path_length_meters(coordinates: list[tuple[float, float]]) -> float:
    total = 0.0
    for previous, current in pairwise(coordinates):
        total += haversine_meters(previous[1], previous[0], current[1], current[0])
    return total


def sample_along_path(
    coordinates: list[tuple[float, float]],
    spacing_meters: float,
) -> list[tuple[float, float]]:
    if len(coordinates) < 2:
        return list(coordinates)
    samples = [coordinates[0]]
    leftover = 0.0
    for previous, current in pairwise(coordinates):
        segment = haversine_meters(previous[1], previous[0], current[1], current[0])
        if segment == 0:
            continue
        distance = leftover
        while distance + spacing_meters <= segment:
            distance += spacing_meters
            t = distance / segment
            samples.append(
                (
                    previous[0] + (current[0] - previous[0]) * t,
                    previous[1] + (current[1] - previous[1]) * t,
                )
            )
        leftover = segment - distance
    if samples[-1] != coordinates[-1]:
        samples.append(coordinates[-1])
    return samples


def offset_lnglat(longitude: float, latitude: float, bearing_radians: float, meters: float) -> tuple[float, float]:
    d_lat = meters * math.cos(bearing_radians) / 110_540.0
    denom = 111_320.0 * max(0.2, math.cos(math.radians(latitude)))
    d_lng = meters * math.sin(bearing_radians) / denom
    return (longitude + d_lng, latitude + d_lat)


def segment_bearing(start: tuple[float, float], end: tuple[float, float]) -> float:
    return math.atan2(end[0] - start[0], end[1] - start[1])


def point_to_segment_meters(
    longitude: float,
    latitude: float,
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    start_lng, start_lat = start
    end_lng, end_lat = end
    dx = end_lng - start_lng
    dy = end_lat - start_lat
    if dx == 0 and dy == 0:
        return haversine_meters(latitude, longitude, start_lat, start_lng)
    t = ((longitude - start_lng) * dx + (latitude - start_lat) * dy) / (dx * dx + dy * dy)
    t = min(1.0, max(0.0, t))
    closest = (start_lng + t * dx, start_lat + t * dy)
    return haversine_meters(latitude, longitude, closest[1], closest[0])


def distance_to_path_meters(longitude: float, latitude: float, coordinates: list[tuple[float, float]]) -> float:
    if not coordinates:
        return float("inf")
    if len(coordinates) == 1:
        return haversine_meters(latitude, longitude, coordinates[0][1], coordinates[0][0])
    return min(
        point_to_segment_meters(longitude, latitude, start, end) for start, end in pairwise(coordinates)
    )


def corridor_around_path(
    coordinates: list[tuple[float, float]],
    spacing_meters: float,
    offsets_meters: tuple[float, ...] = (0.0, 45.0, 90.0),
) -> list[tuple[float, float]]:
    samples = sample_along_path(coordinates, spacing_meters)
    if not samples:
        return []
    points: list[tuple[float, float]] = []
    for index, sample in enumerate(samples):
        previous = samples[index - 1] if index > 0 else samples[min(1, len(samples) - 1)]
        nxt = samples[index + 1] if index + 1 < len(samples) else samples[index - 1 if index > 0 else index]
        heading = segment_bearing(previous, nxt) if previous != nxt else 0.0
        for offset in offsets_meters:
            if offset == 0:
                points.append(sample)
                continue
            points.append(offset_lnglat(sample[0], sample[1], heading + math.pi / 2, offset))
            points.append(offset_lnglat(sample[0], sample[1], heading - math.pi / 2, offset))
    return points
