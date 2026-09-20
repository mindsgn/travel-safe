from travel_safe.geo import (
    corridor_around_path,
    distance_to_path_meters,
    haversine_meters,
    interpolate_lnglat,
    path_length_meters,
    sample_along_path,
)


def test_haversine_zero_for_same_point():
    assert haversine_meters(-33.92, 18.42, -33.92, 18.42) == 0


def test_haversine_grows_with_separation():
    near = haversine_meters(-33.92, 18.42, -33.921, 18.42)
    far = haversine_meters(-33.92, 18.42, -33.93, 18.42)
    assert far > near > 0


def test_interpolate_includes_endpoints():
    points = interpolate_lnglat((18.0, -33.0), (18.1, -33.1), 4)
    assert points[0] == (18.0, -33.0)
    assert points[-1] == (18.1, -33.1)
    assert len(points) == 5


def test_path_length_and_sampling():
    coordinates = [(18.42, -33.92), (18.43, -33.92), (18.43, -33.93)]
    assert path_length_meters(coordinates) > 0
    samples = sample_along_path(coordinates, spacing_meters=200)
    assert samples[0] == coordinates[0]
    assert samples[-1] == coordinates[-1]
    assert len(samples) >= 3


def test_corridor_stays_near_the_path():
    coordinates = [(18.42, -33.92), (18.43, -33.92), (18.43, -33.93)]
    corridor = corridor_around_path(coordinates, spacing_meters=250)
    assert len(corridor) > len(coordinates)
    for lng, lat in corridor:
        assert distance_to_path_meters(lng, lat, coordinates) < 150
