"""YAML configuration loading with CLI overrides."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from dailyvoice_scraper.exceptions import ConfigurationError


@dataclass(frozen=True)
class SiteConfig:
    name: str
    base_url: str
    crime_url: str
    sitemap_url: str


@dataclass(frozen=True)
class ScraperConfig:
    request_delay_seconds: float
    timeout_seconds: float
    max_retries: int
    max_pages: int
    max_articles: int
    user_agent: str
    force_rescrape: bool


@dataclass(frozen=True)
class DatabaseConfig:
    path: Path


@dataclass(frozen=True)
class LoggingConfig:
    level: str


@dataclass(frozen=True)
class DedupWeights:
    same_incident_date: float = 0.30
    same_suburb: float = 0.25
    same_crime_type: float = 0.20
    similar_victim_count: float = 0.10
    similar_title: float = 0.10
    similar_text: float = 0.05


@dataclass(frozen=True)
class CleaningConfig:
    min_confidence: float = 0.70
    export_dir: Path = Path("data/export")


@dataclass(frozen=True)
class DeduplicationConfig:
    probable_duplicate_threshold: float = 0.85
    possible_duplicate_threshold: float = 0.60
    similar_title_threshold: float = 0.92
    weights: DedupWeights = DedupWeights()


@dataclass(frozen=True)
class ValidationSettings:
    allow_future_dates: bool = False
    max_incident_age_days: int = 3650


@dataclass(frozen=True)
class AppConfig:
    site: SiteConfig
    scraper: ScraperConfig
    database: DatabaseConfig
    logging: LoggingConfig
    project_root: Path
    cleaning: CleaningConfig = CleaningConfig()
    deduplication: DeduplicationConfig = DeduplicationConfig()
    validation: ValidationSettings = ValidationSettings()


def _require(mapping: dict[str, Any], key: str) -> Any:
    if key not in mapping:
        raise ConfigurationError(f"Missing configuration key: {key}")
    return mapping[key]


def load_config(
    path: Path | None = None,
    *,
    project_root: Path | None = None,
    max_pages: int | None = None,
    max_articles: int | None = None,
    database_path: Path | None = None,
    log_level: str | None = None,
    force_rescrape: bool | None = None,
) -> AppConfig:
    """Load YAML config and apply optional CLI overrides."""
    root = (project_root or Path.cwd()).resolve()
    config_path = path or _default_config_path(root)
    if not config_path.exists():
        raise ConfigurationError(
            f"Configuration file not found: {config_path}. "
            "Copy config.example.yaml to config.yaml."
        )

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    site_raw = _require(raw, "site")
    scraper_raw = _require(raw, "scraper")
    database_raw = _require(raw, "database")
    logging_raw = raw.get("logging") or {}
    cleaning_raw = raw.get("cleaning") or {}
    dedup_raw = raw.get("deduplication") or {}
    validation_raw = raw.get("validation") or {}
    weights_raw = dedup_raw.get("weights") or {}

    db_path = Path(str(_require(database_raw, "path")))
    if not db_path.is_absolute():
        db_path = root / db_path
    if database_path is not None:
        db_path = database_path if database_path.is_absolute() else root / database_path

    scraper = ScraperConfig(
        request_delay_seconds=float(_require(scraper_raw, "request_delay_seconds")),
        timeout_seconds=float(_require(scraper_raw, "timeout_seconds")),
        max_retries=int(_require(scraper_raw, "max_retries")),
        max_pages=int(max_pages if max_pages is not None else _require(scraper_raw, "max_pages")),
        max_articles=int(
            max_articles if max_articles is not None else _require(scraper_raw, "max_articles")
        ),
        user_agent=str(_require(scraper_raw, "user_agent")),
        force_rescrape=bool(
            force_rescrape if force_rescrape is not None else scraper_raw.get("force_rescrape", False)
        ),
    )

    return AppConfig(
        site=SiteConfig(
            name=str(_require(site_raw, "name")),
            base_url=str(_require(site_raw, "base_url")).rstrip("/"),
            crime_url=str(_require(site_raw, "crime_url")),
            sitemap_url=str(site_raw.get("sitemap_url") or ""),
        ),
        scraper=scraper,
        database=DatabaseConfig(path=db_path),
        logging=LoggingConfig(level=str(log_level or logging_raw.get("level") or "INFO")),
        project_root=root,
        cleaning=CleaningConfig(
            min_confidence=float(cleaning_raw.get("min_confidence", 0.70)),
            export_dir=_resolve_path(root, cleaning_raw.get("export_dir", "data/export")),
        ),
        deduplication=DeduplicationConfig(
            probable_duplicate_threshold=float(dedup_raw.get("probable_duplicate_threshold", 0.85)),
            possible_duplicate_threshold=float(dedup_raw.get("possible_duplicate_threshold", 0.60)),
            similar_title_threshold=float(dedup_raw.get("similar_title_threshold", 0.92)),
            weights=DedupWeights(
                same_incident_date=float(weights_raw.get("same_incident_date", 0.30)),
                same_suburb=float(weights_raw.get("same_suburb", 0.25)),
                same_crime_type=float(weights_raw.get("same_crime_type", 0.20)),
                similar_victim_count=float(weights_raw.get("similar_victim_count", 0.10)),
                similar_title=float(weights_raw.get("similar_title", 0.10)),
                similar_text=float(weights_raw.get("similar_text", 0.05)),
            ),
        ),
        validation=ValidationSettings(
            allow_future_dates=bool(validation_raw.get("allow_future_dates", False)),
            max_incident_age_days=int(validation_raw.get("max_incident_age_days", 3650)),
        ),
    )


def _resolve_path(root: Path, value: str) -> Path:
    path = Path(str(value))
    return path if path.is_absolute() else root / path


def _default_config_path(root: Path) -> Path:
    local = root / "config.yaml"
    if local.exists():
        return local
    return root / "config.example.yaml"
