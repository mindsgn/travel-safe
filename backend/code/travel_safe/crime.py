from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Precinct:
    id: str
    name: str
    latitude: float
    longitude: float
    reported_crimes: int


# Cape Town corridor used by the app mock map. Crime counts are research
# placeholders, not official SAPS statistics.
PRECINCTS: tuple[Precinct, ...] = (
    Precinct("city-bowl", "City Bowl", -33.9249, 18.4241, 144),
    Precinct("harbour", "Harbour District", -33.9043, 18.4204, 76),
    Precinct("green-point", "Green Point", -33.9054, 18.4011, 60),
    Precinct("seafront", "Seafront", -33.9181, 18.3861, 48),
    Precinct("old-quarter", "Old Quarter", -33.9213, 18.4153, 232),
    Precinct("northside", "Northside", -33.9392, 18.4309, 256),
    Precinct("industrial", "Industrial Park", -33.9369, 18.4577, 304),
    Precinct("riverside", "Riverside", -33.9376, 18.4668, 184),
    Precinct("station", "Station Quarter", -33.9216, 18.4266, 204),
    Precinct("parkside", "Parkside", -33.9483, 18.4415, 116),
    Precinct("gardens", "Gardens", -33.9349, 18.4143, 168),
    Precinct("bayview", "Bayview", -33.9516, 18.3825, 36),
)


def max_reported_crimes(precincts: tuple[Precinct, ...] = PRECINCTS) -> int:
    return max(precinct.reported_crimes for precinct in precincts)
