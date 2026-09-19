from unittest.mock import MagicMock

import httpx
from fastapi.testclient import TestClient

from src.main import app
from src.models.safety import Pathway, TripPoint, TripRequest
from src.providers.mapbox_directions import (
    MapboxDirectionsClient,
    MapboxDirectionsError,
)
from src.providers.osrm_directions import OsrmDirectionsClient, OsrmDirectionsError
from src.services.geo import (
    cell_relative_intensity,
    haversine_meters,
    heatmap_grid_points,
    mock_duration_seconds,
    mock_pathway_coordinates,
    pad_bbox,
    pathway_distance_meters,
    point_in_bbox,
    points_along_pathway,
    points_are_the_same,
)
from src.services.trip_service import TripService, TripValidationError

client = TestClient(app)

ORIGIN = {"latitude": -33.9249, "longitude": 18.4241, "label": "Cape Town CBD"}
DESTINATION = {"latitude": -33.9270, "longitude": 18.4470, "label": "Woodstock"}


def test_haversine_is_symmetric_and_positive() -> None:
    there = haversine_meters(-33.92, 18.42, -33.93, 18.45)
    back = haversine_meters(-33.93, 18.45, -33.92, 18.42)
    assert there > 0
    assert there == back


def test_points_are_the_same_uses_meter_threshold() -> None:
    assert points_are_the_same(-33.9249, 18.4241, -33.9249, 18.4241)
    assert not points_are_the_same(-33.9249, 18.4241, -33.9270, 18.4470)


def test_pad_bbox_expands_origin_destination_box() -> None:
    west, south, east, north = pad_bbox(-33.9249, 18.4241, -33.9270, 18.4470)
    assert west < min(18.4241, 18.4470)
    assert east > max(18.4241, 18.4470)
    assert south < min(-33.9249, -33.9270)
    assert north > max(-33.9249, -33.9270)


def test_mock_pathway_starts_and_ends_near_requested_points() -> None:
    coords = mock_pathway_coordinates(-33.9249, 18.4241, -33.9270, 18.4470)
    assert len(coords) >= 2
    assert coords[0][0] == 18.4241
    assert coords[0][1] == -33.9249
    assert coords[-1][0] == 18.4470
    assert coords[-1][1] == -33.9270
    assert pathway_distance_meters(coords) > 0


def test_mock_duration_walking_is_slower_than_driving() -> None:
    walking = mock_duration_seconds(1400, "walking")
    driving = mock_duration_seconds(1400, "driving")
    assert walking > driving


def test_heatmap_grid_points_stay_inside_bbox() -> None:
    bbox = (18.40, -33.96, 18.50, -33.89)
    points = heatmap_grid_points(bbox, columns=3, rows=3)
    assert len(points) == 9
    for latitude, longitude in points:
        assert point_in_bbox(latitude, longitude, bbox)


def test_points_along_pathway_follow_the_line() -> None:
    coords = [(18.42, -33.92), (18.45, -33.93)]
    points = points_along_pathway(coords, samples_per_segment=2, offset_degrees=0.001)
    assert len(points) > len(coords)
    assert any(abs(lat + 33.92) < 0.02 for lat, _lng in points)


def test_cell_relative_intensity_is_deterministic() -> None:
    first = cell_relative_intensity(-33.92, 18.42)
    second = cell_relative_intensity(-33.92, 18.42)
    assert first == second
    assert 0 <= first <= 1


def test_create_trip_returns_road_pathway_and_heatmap() -> None:
    response = client.post("/api/v1/trips", json={"origin": ORIGIN, "destination": DESTINATION})

    assert response.status_code == 200
    body = response.json()
    assert body["origin"]["label"] == "Cape Town CBD"
    assert body["destination"]["label"] == "Woodstock"
    assert body["pathway"]["provider"] in {"osrm", "mapbox", "mock"}
    assert len(body["pathway"]["coordinates"]) >= 2
    assert body["pathway"]["distance_meters"] > 0
    if body["pathway"]["provider"] != "mock":
        assert len(body["pathway"]["coordinates"]) > 2
    assert len(body["heatmap"]["cells"]) >= 36
    west, south, east, north = body["heatmap"]["bbox"]
    for cell in body["heatmap"]["cells"]:
        assert west <= cell["longitude"] <= east
        assert south <= cell["latitude"] <= north
        assert cell["resolution"] == "precinct_aggregate"
    assert any(cell["id"] == "woodstock-precinct-reference" for cell in body["heatmap"]["cells"])
    assert any("not crime-event pins" in caveat.lower() for caveat in body["heatmap"]["caveats"])


def test_create_trip_rejects_identical_origin_and_destination() -> None:
    response = client.post(
        "/api/v1/trips",
        json={"origin": ORIGIN, "destination": ORIGIN},
    )
    assert response.status_code == 422


def test_create_trip_rejects_invalid_coordinates() -> None:
    response = client.post(
        "/api/v1/trips",
        json={
            "origin": {"latitude": 200, "longitude": 18.4},
            "destination": DESTINATION,
        },
    )
    assert response.status_code == 422


def test_trip_service_raises_when_points_match() -> None:
    service = TripService()
    request = TripRequest(
        origin=TripPoint(latitude=-33.92, longitude=18.42),
        destination=TripPoint(latitude=-33.92, longitude=18.42),
    )
    try:
        service.plan(request)
        raise AssertionError("expected TripValidationError")
    except TripValidationError:
        pass


def test_mapbox_directions_client_requires_token() -> None:
    directions = MapboxDirectionsClient(access_token="")
    assert not directions.has_token()
    try:
        directions.route(-33.92, 18.42, -33.93, 18.45, "walking")
        raise AssertionError("expected MapboxDirectionsError")
    except MapboxDirectionsError:
        pass


def test_mapbox_directions_client_parses_geojson_route() -> None:
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "routes": [
                    {
                        "distance": 2100,
                        "duration": 900,
                        "geometry": {
                            "coordinates": [[18.4241, -33.9249], [18.4300, -33.9260], [18.4470, -33.9270]],
                        },
                    }
                ]
            },
        )
    )
    http_client = httpx.Client(transport=transport)
    directions = MapboxDirectionsClient(access_token="pk.test", http_client=http_client)
    pathway = directions.route(-33.9249, 18.4241, -33.9270, 18.4470, "walking")
    assert pathway.provider == "mapbox"
    assert pathway.distance_meters == 2100
    assert pathway.duration_seconds == 900
    assert pathway.coordinates[0] == (18.4241, -33.9249)
    assert pathway.coordinates[-1] == (18.4470, -33.9270)
    http_client.close()


def test_osrm_directions_client_parses_geojson_route() -> None:
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "code": "Ok",
                "routes": [
                    {
                        "distance": 2600,
                        "duration": 480,
                        "geometry": {
                            "coordinates": [
                                [18.4241, -33.9249],
                                [18.4312, -33.9254],
                                [18.4390, -33.9261],
                                [18.4470, -33.9270],
                            ],
                        },
                    }
                ],
            },
        )
    )
    http_client = httpx.Client(transport=transport)
    directions = OsrmDirectionsClient(http_client=http_client)
    pathway = directions.route(-33.9249, 18.4241, -33.9270, 18.4470, "driving")
    assert pathway.provider == "osrm"
    assert len(pathway.coordinates) == 4
    assert pathway.distance_meters == 2600
    http_client.close()


def test_osrm_directions_client_raises_on_error_payload() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"code": "NoRoute", "routes": []}))
    http_client = httpx.Client(transport=transport)
    directions = OsrmDirectionsClient(http_client=http_client)
    try:
        directions.route(-33.92, 18.42, -33.93, 18.45, "driving")
        raise AssertionError("expected OsrmDirectionsError")
    except OsrmDirectionsError:
        pass
    http_client.close()


def test_trip_service_uses_mapbox_when_token_is_set() -> None:
    directions = MagicMock()
    directions.has_token.return_value = True
    directions.route.return_value = Pathway(
        coordinates=[(18.4241, -33.9249), (18.4470, -33.9270)],
        distance_meters=1800,
        duration_seconds=720,
        provider="mapbox",
    )
    service = TripService(directions_client=directions)
    result = service.plan(
        TripRequest(
            origin=TripPoint(latitude=-33.9249, longitude=18.4241),
            destination=TripPoint(latitude=-33.9270, longitude=18.4470),
        )
    )
    assert result.pathway.provider == "mapbox"
    directions.route.assert_called_once()


def test_trip_service_falls_back_to_osrm_when_mapbox_fails() -> None:
    directions = MagicMock()
    directions.has_token.return_value = True
    directions.route.side_effect = MapboxDirectionsError("timeout")
    osrm = MagicMock()
    osrm.route.return_value = Pathway(
        coordinates=[
            (18.4241, -33.9249),
            (18.4300, -33.9255),
            (18.4380, -33.9262),
            (18.4470, -33.9270),
        ],
        distance_meters=2400,
        duration_seconds=420,
        provider="osrm",
    )
    service = TripService(directions_client=directions, osrm_client=osrm)
    result = service.plan(
        TripRequest(
            origin=TripPoint(latitude=-33.9249, longitude=18.4241),
            destination=TripPoint(latitude=-33.9270, longitude=18.4470),
        )
    )
    assert result.pathway.provider == "osrm"
    assert len(result.pathway.coordinates) >= 4
    osrm.route.assert_called_once()
