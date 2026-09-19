from src.models.safety import (
    HeatmapCell,
    HeatmapResponse,
    Pathway,
    TripPoint,
    TripProfile,
    TripRequest,
    TripResponse,
)
from src.providers.base import CrimeDataProvider
from src.providers.mapbox_directions import (
    MapboxDirectionsClient,
    MapboxDirectionsError,
)
from src.providers.osrm_directions import OsrmDirectionsClient, OsrmDirectionsError
from src.providers.reference import ReferenceCrimeProvider
from src.services.geo import (
    cell_relative_intensity,
    heatmap_grid_points,
    mock_duration_seconds,
    mock_pathway_coordinates,
    pad_bbox_from_coordinates,
    pathway_distance_meters,
    point_in_bbox,
    points_along_pathway,
    points_are_the_same,
)
from src.services.safety_service import WOODSTOCK_CENTROID

HEATMAP_CAVEATS = [
    "Cells represent aggregate precinct context, not crime-event pins.",
    "Do not interpret cell centroids as incident locations.",
    "Corridor heatmap is mock crime intensity for frontend integration until live SAPS ingestion.",
]


class TripValidationError(ValueError):
    pass


class TripService:
    def __init__(
        self,
        provider: CrimeDataProvider | None = None,
        directions_client: MapboxDirectionsClient | None = None,
        osrm_client: OsrmDirectionsClient | None = None,
    ) -> None:
        self.provider = provider or ReferenceCrimeProvider()
        self.directions = directions_client or MapboxDirectionsClient()
        self.osrm = osrm_client or OsrmDirectionsClient()

    def plan(self, request: TripRequest) -> TripResponse:
        origin = request.origin
        destination = request.destination
        if points_are_the_same(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude,
        ):
            raise TripValidationError("origin and destination must be different locations")

        pathway = self._pathway(origin, destination, request.profile)
        bbox = pad_bbox_from_coordinates(pathway.coordinates)
        heatmap = self._heatmap(bbox, pathway.coordinates)
        return TripResponse(
            origin=origin,
            destination=destination,
            pathway=pathway,
            heatmap=heatmap,
        )

    def _pathway(
        self,
        origin: TripPoint,
        destination: TripPoint,
        profile: TripProfile,
    ) -> Pathway:
        if self.directions.has_token():
            try:
                return self.directions.route(
                    origin.latitude,
                    origin.longitude,
                    destination.latitude,
                    destination.longitude,
                    profile,
                )
            except MapboxDirectionsError:
                pass
        try:
            return self.osrm.route(
                origin.latitude,
                origin.longitude,
                destination.latitude,
                destination.longitude,
                profile,
            )
        except OsrmDirectionsError:
            if profile == "walking":
                try:
                    return self.osrm.route(
                        origin.latitude,
                        origin.longitude,
                        destination.latitude,
                        destination.longitude,
                        "driving",
                    )
                except OsrmDirectionsError:
                    pass
        return self._mock_pathway(origin, destination, profile)

    def _mock_pathway(
        self,
        origin: TripPoint,
        destination: TripPoint,
        profile: TripProfile,
    ) -> Pathway:
        coordinates = mock_pathway_coordinates(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude,
        )
        distance = pathway_distance_meters(coordinates)
        return Pathway(
            coordinates=coordinates,
            distance_meters=distance,
            duration_seconds=mock_duration_seconds(distance, profile),
            provider="mock",
        )

    def _heatmap(
        self,
        bbox: tuple[float, float, float, float],
        pathway_coordinates: list[tuple[float, float]],
    ) -> HeatmapResponse:
        cells: list[HeatmapCell] = []
        points = heatmap_grid_points(bbox) + [
            point
            for point in points_along_pathway(pathway_coordinates)
            if point_in_bbox(point[0], point[1], bbox)
        ]
        for index, (latitude, longitude) in enumerate(points):
            intensity = cell_relative_intensity(latitude, longitude)
            cells.append(
                HeatmapCell(
                    id=f"corridor-cell-{index}",
                    latitude=latitude,
                    longitude=longitude,
                    label="Mock corridor precinct",
                    reported_crimes=round(intensity * 400),
                    relative_intensity=round(intensity, 4),
                    resolution="precinct_aggregate",
                    source_id="mock-corridor",
                )
            )

        woodstock_lat, woodstock_lng = WOODSTOCK_CENTROID
        if point_in_bbox(woodstock_lat, woodstock_lng, bbox):
            stats = self.provider.area_stats("woodstock")
            if stats is not None:
                cells.append(
                    HeatmapCell(
                        id="woodstock-precinct-reference",
                        latitude=woodstock_lat,
                        longitude=woodstock_lng,
                        label=stats.area_name,
                        reported_crimes=stats.total_reported_crimes,
                        relative_intensity=1.0,
                        resolution="precinct_aggregate",
                        source_id=stats.source_id,
                    )
                )

        return HeatmapResponse(
            bbox=bbox,
            zoom=12,
            cells=cells,
            normalization="corridor-relative mock crime intensity",
            caveats=HEATMAP_CAVEATS,
        )
