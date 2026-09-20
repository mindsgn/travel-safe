"""Thin scraper facade used by the CLI."""

from __future__ import annotations

from dailyvoice_scraper.config import AppConfig
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.http_client import HttpClient
from dailyvoice_scraper.models import ScrapeStats
from dailyvoice_scraper.pipeline import ScrapePipeline


class Scraper:
    """Wires config, HTTP, repository, and pipeline together."""

    def __init__(self, config: AppConfig, repository: ArticleRepository | None = None) -> None:
        self.config = config
        self.repository = repository or ArticleRepository(config.database.path)
        self.repository.initialize()
        self.http = HttpClient(
            user_agent=config.scraper.user_agent,
            timeout_seconds=config.scraper.timeout_seconds,
            max_retries=config.scraper.max_retries,
            request_delay_seconds=config.scraper.request_delay_seconds,
        )

    def scrape(self) -> ScrapeStats:
        pipeline = ScrapePipeline(self.config, self.repository, self.http)
        return pipeline.run()

    def test_connection(self) -> bool:
        response = self.http.get(self.config.site.crime_url)
        return response is not None and response.status_code == 200
