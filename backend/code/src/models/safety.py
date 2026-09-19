from typing import Literal

from pydantic import BaseModel, Field

SourceStatus = Literal["active", "reference_only", "licence_required", "planned"]
SafetyStatus = Literal["available", "insufficient_data"]
RiskBand = Literal["green", "orange", "red"]


class DataSource(BaseModel):
    id: str
    name: str
    status: SourceStatus
    role: str
    url: str
    notes: str


class CrimeCategoryStat(BaseModel):
    category: str
    count: int = Field(ge=0)


class MapCrimeStat(BaseModel):
    category: str
    label: str
    count: int = Field(ge=0)
    danger_weight: float | None = Field(default=None, ge=0, le=1)
    counts_toward_danger_score: bool
    signal_note: str | None = None


class AreaStatsResponse(BaseModel):
    area_code: str
    area_name: str
    area_type: str
    period: str
    total_reported_crimes: int = Field(ge=0)
    previous_period_total: int | None = Field(default=None, ge=0)
    latest_quarter_total: int | None = Field(default=None, ge=0)
    latest_quarter_previous_year: int | None = Field(default=None, ge=0)
    top_categories: list[CrimeCategoryStat]
    source_id: str
    source_url: str
    data_resolution: str
    caveats: list[str]


class HeatmapCell(BaseModel):
    id: str
    latitude: float
    longitude: float
    label: str
    reported_crimes: int = Field(ge=0)
    relative_intensity: float = Field(ge=0, le=1)
    resolution: str
    source_id: str
    year: str | None = None
    local_municipality: str | None = None
    district_municipality: str | None = None
    danger_score: float | None = Field(default=None, ge=0, le=100)
    safety_score: float | None = Field(default=None, ge=0, le=100)
    risk_band: RiskBand | None = None
    color: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    top_crimes: list[MapCrimeStat] = Field(default_factory=list)
    quality_flags: list[str] = Field(default_factory=list)


class HeatmapLegendItem(BaseModel):
    band: str
    min_score: float | None = None
    max_score: float | None = None
    color: str
    meaning: str


class HeatmapResponse(BaseModel):
    bbox: tuple[float, float, float, float]
    zoom: int
    cells: list[HeatmapCell]
    normalization: str
    caveats: list[str]
    year: str | None = None
    source_id: str | None = None
    legend: list[HeatmapLegendItem] = Field(default_factory=list)
    model_version: str | None = None


class SafetySignalResponse(BaseModel):
    area_code: str
    area_name: str
    status: SafetyStatus
    score: float | None = Field(default=None, ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    period: str | None = None
    explanation: list[str]
    source_ids: list[str]


TripProfile = Literal["walking", "driving"]
PathwayProvider = Literal["mapbox", "mock"]


class TripPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    label: str | None = None


class TripRequest(BaseModel):
    origin: TripPoint
    destination: TripPoint
    profile: TripProfile = "walking"


class Pathway(BaseModel):
    coordinates: list[tuple[float, float]] = Field(min_length=2)
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    provider: PathwayProvider


class TripResponse(BaseModel):
    origin: TripPoint
    destination: TripPoint
    pathway: Pathway
    heatmap: HeatmapResponse
    danger_score: float | None = Field(default=None, ge=0, le=100)
    risk_band: RiskBand | None = None
    color: str | None = None
    top_crimes: list[MapCrimeStat] = Field(default_factory=list)
    model_version: str | None = None


class DatasetStatusResponse(BaseModel):
    loaded: bool
    source_id: str
    dataset_version: str
    path: str | None = None
    latest_year: str | None = None
    years: list[str] = Field(default_factory=list)
    records: int = Field(default=0, ge=0)
    stations_latest_year: int = Field(default=0, ge=0)
    mappable_latest_year: int = Field(default=0, ge=0)
    load_error: str | None = None
    nationwide_ready: bool = False
    model_version: str = "danger-v1.1"
    data_mode: str = "reference_only"


class MapSearchResult(BaseModel):
    result_type: Literal["police_station"]
    id: str
    name: str
    latitude: float
    longitude: float
    subtitle: str | None = None
    color: str
    year: str | None = None
    danger_score: float | None = Field(default=None, ge=0, le=100)
    safety_score: float | None = Field(default=None, ge=0, le=100)
    risk_band: RiskBand | None = None
    top_crimes: list[MapCrimeStat] = Field(default_factory=list)


class MapSearchResponse(BaseModel):
    query: str
    results: list[MapSearchResult]
