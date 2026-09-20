from pathlib import Path

from dailyvoice_scraper.cleaning.pipeline import CleaningPipeline
from dailyvoice_scraper.cleaning.store import CleaningStore
from dailyvoice_scraper.config import (
    AppConfig,
    CleaningConfig,
    DatabaseConfig,
    DeduplicationConfig,
    LoggingConfig,
    ScraperConfig,
    SiteConfig,
    ValidationSettings,
)
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.dates import utc_now_iso
from dailyvoice_scraper.hashing import content_hash
from dailyvoice_scraper.models import Article


def _config(tmp_path: Path) -> AppConfig:
    return AppConfig(
        site=SiteConfig(
            name="Daily Voice",
            base_url="https://dailyvoice.co.za",
            crime_url="https://dailyvoice.co.za/news/",
            sitemap_url="",
        ),
        scraper=ScraperConfig(
            request_delay_seconds=0,
            timeout_seconds=1,
            max_retries=1,
            max_pages=1,
            max_articles=1,
            user_agent="test",
            force_rescrape=False,
        ),
        database=DatabaseConfig(path=tmp_path / "clean.sqlite3"),
        logging=LoggingConfig(level="WARNING"),
        project_root=tmp_path,
        cleaning=CleaningConfig(min_confidence=0.70, export_dir=tmp_path / "export"),
        deduplication=DeduplicationConfig(),
        validation=ValidationSettings(),
    )


def _insert(repo: ArticleRepository, title: str, body: str, url_slug: str) -> int:
    url = f"https://dailyvoice.co.za/news/2026-09-20-{url_slug}/"
    return repo.insert_article(
        Article(
            source="Daily Voice",
            source_url=url,
            canonical_url=url,
            title=title,
            article_text=body,
            content_hash=content_hash(title, body),
            published_at="2026-09-20T12:00:00+00:00",
            scraped_at=utc_now_iso(),
        )
    )


def test_clean_article(tmp_path: Path) -> None:
    repo = ArticleRepository(tmp_path / "clean.sqlite3")
    repo.initialize()
    try:
        _insert(
            repo,
            "Man shot dead in Nyanga",
            "A 23-year-old man was shot dead in Nyanga on Thursday evening. Police said no arrests have been made.",
            "nyanga-shooting",
        )
        stats = CleaningPipeline(_config(tmp_path), repo).run()
        store = CleaningStore(repo)
        assert stats.processed == 1
        assert store.count("cleaned_articles") == 1
        assert store.count("incidents") == 1
        incident = store.list_incidents()[0]
        assert incident["crime_type"] == "murder"
        assert incident["suburb"] == "Nyanga"
        assert incident["latitude"] is None
    finally:
        repo.close()


def test_failed_article_goes_to_review(tmp_path: Path) -> None:
    repo = ArticleRepository(tmp_path / "clean.sqlite3")
    repo.initialize()
    try:
        _insert(repo, "<p></p>", "<div></div>", "empty-html")
        stats = CleaningPipeline(_config(tmp_path), repo).run()
        store = CleaningStore(repo)
        assert stats.failed == 1
        assert store.list_cleaned()[0]["cleaning_status"] == "failed"
        assert store.count("review_queue") >= 1
    finally:
        repo.close()


def test_cleaning_is_idempotent(tmp_path: Path) -> None:
    repo = ArticleRepository(tmp_path / "clean.sqlite3")
    repo.initialize()
    try:
        _insert(
            repo,
            "Oupa robbed in Delft",
            "An oupa was robbed at gunpoint in Delft on 8 September while cycling to work.",
            "delft-robbery",
        )
        pipeline = CleaningPipeline(_config(tmp_path), repo)
        first = pipeline.run()
        second = pipeline.run()
        store = CleaningStore(repo)
        assert first.processed == 1
        assert second.processed == 0
        assert store.count("cleaned_articles") == 1
        assert store.count("incidents") == 1
    finally:
        repo.close()


def test_reprocessing(tmp_path: Path) -> None:
    repo = ArticleRepository(tmp_path / "clean.sqlite3")
    repo.initialize()
    try:
        _insert(
            repo,
            "Oupa robbed in Delft",
            "An oupa was robbed at gunpoint in Delft on 8 September while cycling to work.",
            "delft-robbery",
        )
        before = repo.raw_articles_fingerprint()
        pipeline = CleaningPipeline(_config(tmp_path), repo)
        pipeline.run()
        store = CleaningStore(repo)
        first_incident = store.list_incidents()[0]["crime_type"]
        pipeline.run(reprocess=True)
        after = repo.raw_articles_fingerprint()
        assert before == after
        assert store.count("cleaned_articles") == 1
        assert store.count("incidents") == 1
        assert store.list_incidents()[0]["crime_type"] == first_incident
    finally:
        repo.close()
