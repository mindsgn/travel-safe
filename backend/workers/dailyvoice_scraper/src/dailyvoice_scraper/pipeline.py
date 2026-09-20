"""Orchestrates HTTP → parse → validate → classify → repository."""

from __future__ import annotations

import logging
import sqlite3
from datetime import UTC, datetime

from dailyvoice_scraper.classification import maybe_incident
from dailyvoice_scraper.config import AppConfig
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.dates import utc_now_iso
from dailyvoice_scraper.exceptions import HttpClientError, ParseError, ValidationError
from dailyvoice_scraper.http_client import HttpClient
from dailyvoice_scraper.locations import extract_location
from dailyvoice_scraper.models import ScrapeStats
from dailyvoice_scraper.sources.daily_voice import DailyVoiceSource
from dailyvoice_scraper.validation import validate_article

logger = logging.getLogger(__name__)


class ScrapePipeline:
    def __init__(
        self,
        config: AppConfig,
        repository: ArticleRepository,
        http: HttpClient,
        source: DailyVoiceSource | None = None,
    ) -> None:
        self.config = config
        self.repository = repository
        self.http = http
        self.source = source or DailyVoiceSource(
            listing_url=config.site.crime_url,
            sitemap_url=config.site.sitemap_url,
            base_url=config.site.base_url,
        )

    def run(self) -> ScrapeStats:
        stats = ScrapeStats(started_at=datetime.now(tz=UTC))
        logger.info("Starting scraper")
        urls, pages = self.source.discover_articles(
            self.http,
            max_pages=self.config.scraper.max_pages,
            max_articles=self.config.scraper.max_articles,
        )
        stats.pages_processed = pages
        stats.article_urls_found = len(urls)

        for index, url in enumerate(urls, start=1):
            logger.info("Scraping article %s/%s", index, len(urls))
            self._process_url(url, stats)

        stats.database_total = self.repository.get_article_count()
        stats.finished_at = datetime.now(tz=UTC)
        logger.info("Scraping completed")
        return stats

    def _process_url(self, url: str, stats: ScrapeStats) -> None:
        if not self.config.scraper.force_rescrape and self.repository.article_exists(url):
            logger.info("Article already exists: %s", url)
            stats.already_existed += 1
            return

        try:
            response = self.http.get(url)
        except HttpClientError:
            logger.warning("HTTP failure for %s", url)
            stats.http_failures += 1
            return
        if response is None:
            stats.http_failures += 1
            return

        stats.articles_downloaded += 1
        try:
            article = self.source.parse_article(response.text, response.url or url)
            validate_article(article)
        except (ParseError, ValidationError) as exc:
            logger.warning("Failed to parse article: %s (%s)", url, exc)
            stats.parse_failures += 1
            return
        except Exception as exc:  # noqa: BLE001 — a single bad page must not abort the run
            logger.warning("Failed to parse article: %s (%s)", url, exc)
            stats.parse_failures += 1
            return

        canonical = article.canonical_url or article.source_url
        if not self.config.scraper.force_rescrape and (
            self.repository.article_exists(canonical)
            or self.repository.content_hash_exists(article.content_hash)
        ):
            logger.info("Article already exists: %s", canonical)
            stats.already_existed += 1
            return

        article.scraped_at = utc_now_iso()
        location_fields = extract_location(f"{article.title}\n{article.article_text}")
        article.location = location_fields["location"]

        try:
            article_id = self.repository.insert_article(article)
        except sqlite3.IntegrityError:
            logger.info("Article already exists: %s", canonical)
            stats.already_existed += 1
            return
        except sqlite3.Error:
            logger.exception("Database error inserting %s", canonical)
            stats.parse_failures += 1
            return

        incident = maybe_incident(article, article.location)
        if incident is not None:
            incident.article_id = article_id
            incident.province = location_fields["province"]
            incident.city = location_fields["city"]
            incident.suburb = location_fields["suburb"]
            incident.police_station = location_fields["police_station"]
            try:
                self.repository.insert_incident(incident)
            except sqlite3.Error:
                logger.exception("Database error inserting incident for %s", canonical)

        logger.info("Saved article: %s", article.title)
        stats.articles_inserted += 1
