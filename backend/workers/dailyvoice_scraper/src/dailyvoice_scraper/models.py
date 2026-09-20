"""Domain models. These are source-agnostic so extra news sites can reuse them."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Article:
    source: str
    source_url: str
    title: str
    article_text: str
    content_hash: str
    canonical_url: str | None = None
    subtitle: str | None = None
    author: str | None = None
    published_at: str | None = None
    published_at_raw: str | None = None
    updated_at: str | None = None
    category: str | None = None
    tags: str | None = None
    location: str | None = None
    image_url: str | None = None
    scraped_at: str | None = None
    id: int | None = None


@dataclass
class CrimeIncident:
    article_id: int | None
    crime_type: str | None
    location: str | None
    incident_date: str | None
    victim_count: int | None
    suspect_count: int | None
    extraction_confidence: float | None
    crime_type_confidence: float | None = None
    province: str | None = None
    city: str | None = None
    suburb: str | None = None
    police_station: str | None = None
    id: int | None = None


@dataclass
class ScrapeStats:
    pages_processed: int = 0
    article_urls_found: int = 0
    articles_downloaded: int = 0
    articles_inserted: int = 0
    already_existed: int = 0
    parse_failures: int = 0
    http_failures: int = 0
    database_total: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    notes: list[str] = field(default_factory=list)

    def format_summary(self) -> str:
        return (
            "Scraping completed\n\n"
            f"Pages processed:      {self.pages_processed:>5}\n"
            f"Article URLs found:   {self.article_urls_found:>5}\n"
            f"Articles downloaded:  {self.articles_downloaded:>5}\n"
            f"Articles inserted:    {self.articles_inserted:>5}\n"
            f"Already existed:      {self.already_existed:>5}\n"
            f"Parse failures:       {self.parse_failures:>5}\n"
            f"HTTP failures:        {self.http_failures:>5}\n"
            f"Database total:       {self.database_total:>5}"
        )
