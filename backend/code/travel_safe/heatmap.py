from __future__ import annotations

from travel_safe.crime import PRECINCTS, Precinct, max_reported_crimes
from travel_safe.geo import corridor_around_path, distance_to_path_meters
from travel_safe.routing import Pathway

IDW_EPSILON = 1e-9
LOCATION_GRID = 5
PATH_CORRIDOR_METERS = 120.0


def interpolate_crimes(latitude: float, longitude: float, precincts: tuple[Precinct, ...] = PRECINCTS) -> float:
    weighted_sum = 0.0
    total_weight = 0.0
    for precinct in precincts:
        d_lat = latitude - precinct.latitude
        d_lng = longitude - precinct.longitude
        weight = 1.0 / (d_lat * d_lat + d_lng * d_lng + IDW_EPSILON)
        weighted_sum += weight * precinct.reported_crimes
        total_weight += weight
    if total_weight == 0:
        return 0.0
    return weighted_sum / total_weight


def bbox_for_points(points: list[tuple[float, float]], padding: float = 0.01) -> list[float]:
    lngs = [point[0] for point in points]
    lats = [point[1] for point in points]
    return [
        min(lngs) - padding,
        min(lats) - padding,
        max(lngs) + padding,
        max(lats) + padding,
    ]


def cell_from_point(
    cell_id: str,
    latitude: float,
    longitude: float,
    precincts: tuple[Precinct, ...] = PRECINCTS,
) -> dict:
    crimes = interpolate_crimes(latitude, longitude, precincts)
    peak = max_reported_crimes(precincts)
    intensity = min(1.0, max(0.0, crimes / peak if peak else 0.0))
    return {
        "id": cell_id,
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "label": "Safety heatmap",
        "reported_crimes": round(crimes),
        "relative_intensity": round(intensity, 4),
        "resolution": "precinct_aggregate",
        "source_id": "sqlite-precincts",
    }


def heatmap_along_pathway(pathway: Pathway, spacing_meters: float = 120.0) -> dict:
    corridor = corridor_around_path(pathway.coordinates, spacing_meters)
    cells = []
    for index, (lng, lat) in enumerate(corridor):
        if distance_to_path_meters(lng, lat, pathway.coordinates) > PATH_CORRIDOR_METERS:
            continue
        cells.append(cell_from_point(f"path-{index}", latitude=lat, longitude=lng))
    return {
        "bbox": bbox_for_points(pathway.coordinates, padding=0.004),
        "zoom": 13,
        "cells": cells,
        "normalization": "idw-precinct-crime-max",
        "caveats": [
            "Heatmap is limited to a roadway corridor around the searched pathway.",
            "Values are not official crime statistics.",
        ],
    }


def heatmap_around_location(latitude: float, longitude: float, span: float = 0.03) -> dict:
    cells = []
    for column in range(LOCATION_GRID):
        for row in range(LOCATION_GRID):
            t_x = column / (LOCATION_GRID - 1)
            t_y = row / (LOCATION_GRID - 1)
            cell_lat = latitude - span / 2 + t_y * span
            cell_lng = longitude - span / 2 + t_x * span
            cells.append(cell_from_point(f"loc-{column}-{row}", cell_lat, cell_lng))
    points = [(cell["longitude"], cell["latitude"]) for cell in cells]
    return {
        "bbox": bbox_for_points(points),
        "zoom": 14,
        "cells": cells,
        "normalization": "idw-precinct-crime-max",
        "caveats": [
            "Heatmap is centred on the reported GPS location.",
            "Values are not official crime statistics.",
        ],
    }
