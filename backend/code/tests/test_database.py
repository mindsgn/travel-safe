from travel_safe.database import (
    connect,
    count_location_pings,
    save_location,
    save_trip,
    upsert_device,
)


def test_upsert_device_is_idempotent(tmp_path):
    connection = connect(str(tmp_path / "db.sqlite"))
    upsert_device(connection, "TS-ABC12345")
    upsert_device(connection, "TS-ABC12345")
    row = connection.execute("SELECT COUNT(*) AS n FROM devices").fetchone()
    assert row["n"] == 1


def test_save_location_and_trip(tmp_path):
    connection = connect(str(tmp_path / "db.sqlite"))
    save_location(connection, "TS-ABC12345", -33.92, 18.42, 12.0)
    save_location(connection, "TS-ABC12345", -33.921, 18.421, None)
    assert count_location_pings(connection, "TS-ABC12345") == 2
    save_trip(connection, "TS-ABC12345", -33.92, 18.42, -33.93, 18.45, "osrm", 1200)
    trips = connection.execute("SELECT * FROM trips").fetchall()
    assert len(trips) == 1
    assert trips[0]["provider"] == "osrm"
