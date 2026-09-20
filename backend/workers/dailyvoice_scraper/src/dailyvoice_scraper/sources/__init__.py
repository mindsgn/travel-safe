"""News source interface used by the pipeline.

Additional sites (News24, IOL, GroundUp, The Citizen, SAPS media) should
implement this protocol rather than changing the repository or CLI.
"""

from __future__ import annotations

from typing import Protocol

from dailyvoice_scraper.http_client import HttpClient
from dailyvoice_scraper.models import Article


class NewsSource(Protocol):
    name: str

    def discover_articles(self, http: HttpClient, max_pages: int, max_articles: int) -> tuple[list[str], int]:
        """Return (unique article URLs, pages_processed)."""

    def parse_article(self, html: str, url: str) -> Article:
        ...
