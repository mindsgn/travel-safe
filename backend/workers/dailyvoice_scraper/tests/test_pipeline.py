from pathlib import Path

from dailyvoice_scraper.config import AppConfig, DatabaseConfig, LoggingConfig, ScraperConfig, SiteConfig
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.http_client import HttpClient, HttpResponse
from dailyvoice_scraper.pipeline import ScrapePipeline

FIXTURES = Path(__file__).parent / "fixtures"
LISTING_URL = "https://dailyvoice.co.za/news/"
ARTICLE_URL = "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/"
SECOND_URL = "https://dailyvoice.co.za/news/western-cape/2026-09-20-body-hidden-under-coffin-police-probe-paarl-undertakers-alleged-irregularities/"


class FakeHttp(HttpClient):
    def __init__(self, mapping: dict[str, HttpResponse | Exception | None]) -> None:
        self.mapping = mapping
        self.user_agent = "test-bot"
        self.timeout_seconds = 1
        self.max_retries = 1
        self.request_delay_seconds = 0

    def get(self, url: str) -> HttpResponse | None:  # type: ignore[override]
        payload = self.mapping.get(url)
        if isinstance(payload, Exception):
            raise payload
        return payload


def _config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        site=SiteConfig(
            name="Daily Voice",
            base_url="https://dailyvoice.co.za",
            crime_url=LISTING_URL,
            sitemap_url="",
        ),
        scraper=ScraperConfig(
            request_delay_seconds=0,
            timeout_seconds=5,
            max_retries=1,
            max_pages=1,
            max_articles=10,
            user_agent="test-bot",
            force_rescrape=False,
        ),
        database=DatabaseConfig(path=tmp_path / "test.sqlite3"),
        logging=LoggingConfig(level="INFO"),
        project_root=tmp_path,
    )


def test_scrape_pipeline(tmp_path: Path) -> None:
    listing = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    article = (FIXTURES / "article.html").read_text(encoding="utf-8")
    http = FakeHttp(
        {
            LISTING_URL: HttpResponse(LISTING_URL, 200, listing, {}),
            ARTICLE_URL: HttpResponse(ARTICLE_URL, 200, article, {}),
            SECOND_URL: HttpResponse(SECOND_URL, 200, article, {}),
        }
    )
    repo = ArticleRepository(tmp_path / "test.sqlite3")
    repo.initialize()
    try:
        stats = ScrapePipeline(_config(tmp_path), repo, http).run()
        assert stats.article_urls_found == 2
        # Second URL reuses the same article fixture, so content-hash dedupe skips it.
        assert stats.articles_inserted == 1
        assert repo.get_article_count() == 1
    finally:
        repo.close()


def test_existing_article_is_skipped(tmp_path: Path) -> None:
    listing = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    article = (FIXTURES / "article.html").read_text(encoding="utf-8")
    mapping = {
        LISTING_URL: HttpResponse(LISTING_URL, 200, listing, {}),
        ARTICLE_URL: HttpResponse(ARTICLE_URL, 200, article, {}),
        SECOND_URL: HttpResponse(SECOND_URL, 200, article, {}),
    }
    repo = ArticleRepository(tmp_path / "test.sqlite3")
    repo.initialize()
    config = _config(tmp_path)
    try:
        first = ScrapePipeline(config, repo, FakeHttp(mapping)).run()
        second = ScrapePipeline(config, repo, FakeHttp(mapping)).run()
        assert first.articles_inserted == 1
        assert second.articles_inserted == 0
        assert second.already_existed >= 1
        assert repo.get_article_count() == 1
    finally:
        repo.close()


def test_failed_article_does_not_stop_pipeline(tmp_path: Path) -> None:
    listing = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    article = (FIXTURES / "article.html").read_text(encoding="utf-8")
    malformed = (FIXTURES / "malformed_article.html").read_text(encoding="utf-8")
    http = FakeHttp(
        {
            LISTING_URL: HttpResponse(LISTING_URL, 200, listing, {}),
            ARTICLE_URL: HttpResponse(ARTICLE_URL, 200, malformed, {}),
            SECOND_URL: HttpResponse(SECOND_URL, 200, article, {}),
        }
    )
    repo = ArticleRepository(tmp_path / "test.sqlite3")
    repo.initialize()
    try:
        stats = ScrapePipeline(_config(tmp_path), repo, http).run()
        assert stats.parse_failures == 1
        assert stats.articles_inserted == 1
        assert repo.get_article_count() == 1
    finally:
        repo.close()
