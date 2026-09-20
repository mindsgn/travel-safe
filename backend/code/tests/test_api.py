from unittest.mock import patch

from travel_safe.geo import distance_to_path_meters
from travel_safe.heatmap import PATH_CORRIDOR_METERS
from travel_safe.routing import Pathway


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_device(client):
    response = client.post("/api/v1/devices", json={"device_code": "TS-PHONE01"})
    assert response.status_code == 200
    assert response.json()["device_code"] == "TS-PHONE01"


def test_trip_returns_road_pathway_and_heatmap(client):
    fake = Pathway(
        coordinates=[
            (18.4241, -33.9249),
            (18.4300, -33.9200),
            (18.4400, -33.9250),
            (18.4470, -33.9270),
        ],
        distance_meters=2400,
        duration_seconds=380,
        provider="osrm",
    )
    with patch("travel_safe.main.plan_road_pathway", return_value=fake):
        response = client.post(
            "/api/v1/trips",
            json={
                "origin": {"latitude": -33.9249, "longitude": 18.4241, "label": "CBD"},
                "destination": {"latitude": -33.927, "longitude": 18.447, "label": "Woodstock"},
                "profile": "driving",
                "device_code": "TS-PHONE01",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["pathway"]["provider"] == "osrm"
    assert len(body["pathway"]["coordinates"]) >= 3
    assert body["pathway"]["coordinates"][0] != body["pathway"]["coordinates"][1]
    assert body["heatmap"]["cells"]
    assert body["origin"]["label"] == "CBD"
    for cell in body["heatmap"]["cells"]:
        assert cell["source_id"] == "sqlite-precincts"
        assert (
            distance_to_path_meters(cell["longitude"], cell["latitude"], fake.coordinates)
            <= PATH_CORRIDOR_METERS
        )


def test_trip_rejects_identical_points(client):
    point = {"latitude": -33.9249, "longitude": 18.4241}
    response = client.post("/api/v1/trips", json={"origin": point, "destination": point})
    assert response.status_code == 422


def test_location_ping_saves_and_returns_nothing(client):
    response = client.post(
        "/api/v1/devices/TS-PHONE01/location",
        json={"latitude": -33.9249, "longitude": 18.4241, "accuracy_meters": 8},
    )
    assert response.status_code == 204
    assert response.content == b""


def test_location_heatmap_saves_and_returns_cells(client):
    response = client.post(
        "/api/v1/devices/TS-PHONE01/location/heatmap",
        json={"latitude": -33.9249, "longitude": 18.4241, "accuracy_meters": 8},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["saved_pings"] == 1
    assert len(body["heatmap"]["cells"]) == 25
    assert body["latitude"] == -33.9249
