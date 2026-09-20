"""Daily Voice news source.

Pagination note (2026-09-20): the public listing at /news/ uses a client-side
Load more control. robots.txt disallows /api/, so this source does not call
internal APIs. Page 1 is the HTML listing. Further pages use the public news
sitemap advertised in robots.txt, which currently exposes the latest ~200 URLs
in a single document (query-string page=N does not change the document).
"""

from __future__ import annotations

import logging

from dailyvoice_scraper.http_client import HttpClient
from dailyvoice_scraper.models import Article
from dailyvoice_scraper.parser import DailyVoiceParser
from dailyvoice_scraper.urls import normalize_url

logger = logging.getLogger(__name__)


class DailyVoiceSource:
    name = "Daily Voice"

    def __init__(
        self,
        *,
        listing_url: str,
        sitemap_url: str,
        base_url: str,
        parser: DailyVoiceParser | None = None,
    ) -> None:
        self.listing_url = listing_url
        self.sitemap_url = sitemap_url
        self.base_url = base_url
        self.parser = parser or DailyVoiceParser(base_url=base_url, source_name=self.name)

    def discover_articles(
        self, http: HttpClient, max_pages: int, max_articles: int
    ) -> tuple[list[str], int]:
        found: list[str] = []
        seen: set[str] = set()
        pages_processed = 0

        pages_processed += 1
        logger.info("Fetching listing page %s", pages_processed)
        listing = http.get(self.listing_url)
        if listing is None:
            logger.warning("Listing page returned a skippable HTTP status")
        else:
            for url in self.parser.parse_listing(listing.text):
                if url not in seen:
                    seen.add(url)
                    found.append(url)
            logger.info("Found %s article URLs", len(found))

        if max_pages > 1 and self.sitemap_url and len(found) < max_articles:
            pages_processed += 1
            logger.info("Fetching listing page %s (public sitemap)", pages_processed)
            sitemap = http.get(self.sitemap_url)
            if sitemap is None:
                logger.warning("Sitemap returned a skippable HTTP status")
            else:
                extra = 0
                for url in self.parser.parse_sitemap(sitemap.text):
                    normalized = normalize_url(url, self.base_url)
                    if normalized not in seen:
                        seen.add(normalized)
                        found.append(normalized)
                        extra += 1
                logger.info("Found %s additional article URLs from sitemap", extra)

        return found[:max_articles], pages_processed

    def parse_article(self, html: str, url: str) -> Article:
        return self.parser.parse_article(html, url)
