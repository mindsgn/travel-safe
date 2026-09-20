from travel_safe.routing import (
    LatLng,
    fetch_mapbox_pathway,
    manhattan_road_pathway,
    parse_osrm_route,
    plan_road_pathway,
)

ORIGIN = LatLng(-33.9249, 18.4241, "CBD")
DESTINATION = LatLng(-33.9270, 18.4470, "Woodstock")


def test_manhattan_pathway_is_not_a_straight_line():
    pathway = manhattan_road_pathway(ORIGIN, DESTINATION)
    assert pathway.provider == "mock"
    assert len(pathway.coordinates) >= 3
    assert pathway.coordinates[0] == (ORIGIN.longitude, ORIGIN.latitude)
    assert pathway.coordinates[-1] == (DESTINATION.longitude, DESTINATION.latitude)
    mid = pathway.coordinates[len(pathway.coordinates) // 2]
    assert mid != pathway.coordinates[0]
    assert mid != pathway.coordinates[-1]


def test_manhattan_pathway_handles_same_latitude():
    dest = LatLng(ORIGIN.latitude, ORIGIN.longitude + 0.02)
    pathway = manhattan_road_pathway(ORIGIN, dest)
    assert len(pathway.coordinates) >= 3
    lats = {round(point[1], 5) for point in pathway.coordinates}
    assert len(lats) > 1


def test_parse_osrm_route_requires_three_points():
    assert parse_osrm_route({"code": "Ok", "routes": [{"geometry": {"coordinates": [[18, -33], [18.1, -33.1]]}}]}) is None
    parsed = parse_osrm_route(
        {
            "code": "Ok",
            "routes": [
                {
                    "distance": 1200,
                    "duration": 180,
                    "geometry": {"coordinates": [[18.42, -33.92], [18.43, -33.925], [18.45, -33.93]]},
                }
            ],
        }
    )
    assert parsed is not None
    assert parsed.provider == "osrm"
    assert parsed.distance_meters == 1200
    assert len(parsed.coordinates) == 3


def test_plan_road_pathway_prefers_mapbox_then_osrm():
    def fake_get(url: str) -> dict:
        if "mapbox.com" in url:
            return {
                "routes": [
                    {
                        "distance": 2100,
                        "duration": 400,
                        "geometry": {
                            "coordinates": [
                                [18.4241, -33.9249],
                                [18.4300, -33.9200],
                                [18.4400, -33.9250],
                                [18.4470, -33.9270],
                            ]
                        },
                    }
                ],
            }
        return {
            "code": "Ok",
            "routes": [
                {
                    "distance": 1800,
                    "duration": 300,
                    "geometry": {
                        "coordinates": [
                            [18.4241, -33.9249],
                            [18.4470, -33.9270],
                            [18.4470, -33.9271],
                        ]
                    },
                }
            ],
        }

    pathway = plan_road_pathway(ORIGIN, DESTINATION, http_get=fake_get)
    assert pathway.provider in {"mapbox", "osrm"}
    assert len(pathway.coordinates) >= 3


def test_fetch_mapbox_pathway_follows_road_geometry():
    def fake_get(url: str) -> dict:
        assert "mapbox.com" in url
        assert "pk.test" in url
        return {
            "routes": [
                {
                    "distance": 2400,
                    "duration": 380,
                    "geometry": {
                        "coordinates": [
                            [18.4241, -33.9249],
                            [18.431, -33.921],
                            [18.44, -33.925],
                            [18.447, -33.927],
                        ]
                    },
                }
            ]
        }

    pathway = fetch_mapbox_pathway(ORIGIN, DESTINATION, http_get=fake_get, token="pk.test")
    assert pathway is not None
    assert pathway.provider == "mapbox"
    assert len(pathway.coordinates) == 4


def test_plan_road_pathway_falls_back_when_osrm_fails():
    def boom(_url: str) -> dict:
        raise OSError("offline")

    pathway = plan_road_pathway(ORIGIN, DESTINATION, http_get=boom)
    assert pathway.provider == "mock"
    assert len(pathway.coordinates) >= 3
