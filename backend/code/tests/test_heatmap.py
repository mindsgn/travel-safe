from travel_safe.geo import distance_to_path_meters
from travel_safe.heatmap import (
    PATH_CORRIDOR_METERS,
    heatmap_along_pathway,
    heatmap_around_location,
    interpolate_crimes,
)
from travel_safe.routing import LatLng, manhattan_road_pathway


def test_interpolate_crimes_is_higher_near_industrial_than_bayview():
    industrial = interpolate_crimes(-33.9369, 18.4577)
    bayview = interpolate_crimes(-33.9516, 18.3825)
    assert industrial > bayview


def test_heatmap_along_pathway_follows_route_samples():
    pathway = manhattan_road_pathway(LatLng(-33.9249, 18.4241), LatLng(-33.927, 18.447))
    heatmap = heatmap_along_pathway(pathway, spacing_meters=400)
    assert heatmap["cells"]
    assert heatmap["bbox"][0] <= heatmap["bbox"][2]
    for cell in heatmap["cells"]:
        assert 0 <= cell["relative_intensity"] <= 1
        assert "id" in cell
        assert (
            distance_to_path_meters(cell["longitude"], cell["latitude"], pathway.coordinates)
            <= PATH_CORRIDOR_METERS
        )


def test_heatmap_along_pathway_does_not_cover_distant_city_points():
    pathway = manhattan_road_pathway(LatLng(-33.9249, 18.4241), LatLng(-33.927, 18.447))
    heatmap = heatmap_along_pathway(pathway, spacing_meters=400)
    far_lng, far_lat = 18.3825, -33.9516
    nearest = min(
        distance_to_path_meters(cell["longitude"], cell["latitude"], [(far_lng, far_lat)])
        for cell in heatmap["cells"]
    )
    assert nearest > PATH_CORRIDOR_METERS


def test_heatmap_around_location_is_centred():
    heatmap = heatmap_around_location(-33.9249, 18.4241)
    assert len(heatmap["cells"]) == 25
    lats = [cell["latitude"] for cell in heatmap["cells"]]
    lngs = [cell["longitude"] for cell in heatmap["cells"]]
    assert min(lats) < -33.9249 < max(lats)
    assert min(lngs) < 18.4241 < max(lngs)
