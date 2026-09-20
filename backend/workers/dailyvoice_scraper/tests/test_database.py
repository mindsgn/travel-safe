from collections.abc import Iterator
from pathlib import Path

import pytest
import sqlite3

from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.dates import utc_now_iso
from dailyvoice_scraper.hashing import content_hash
from dailyvoice_scraper.models import Article


def _article(**overrides: object) -> Article:
    title = str(overrides.get("title", "Example"))
    body = str(overrides.get("article_text", "Body text that is stored in full."))
    defaults = {
        "source": "Daily Voice",
        "source_url": "https://dailyvoice.co.za/news/2026-09-20-example/",
        "canonical_url": "https://dailyvoice.co.za/news/2026-09-20-example/",
        "title": title,
        "article_text": body,
        "content_hash": content_hash(title, body),
        "scraped_at": utc_now_iso(),
    }
    defaults.update(overrides)
    return Article(**defaults)  # type: ignore[arg-type]


@pytest.fixture
def repo(tmp_path: Path) -> Iterator[ArticleRepository]:
    repository = ArticleRepository(tmp_path / "test.sqlite3")
    repository.initialize()
    yield repository
    repository.close()


def test_database_initialization(repo: ArticleRepository) -> None:
    assert repo.get_article_count() == 0
    tables = {
        row["name"]
        for row in repo._connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    assert "articles" in tables
    assert "crime_incidents" in tables
    assert "cleaned_articles" in tables
    assert "incidents" in tables
    assert "review_queue" in tables


def test_insert_article(repo: ArticleRepository) -> None:
    article_id = repo.insert_article(_article())
    assert article_id >= 1


def test_get_article(repo: ArticleRepository) -> None:
    article_id = repo.insert_article(_article(title="Stored title"))
    loaded = repo.get_article(article_id)
    assert loaded is not None
    assert loaded.title == "Stored title"


def test_duplicate_url(repo: ArticleRepository) -> None:
    repo.insert_article(_article())
    with pytest.raises(sqlite3.IntegrityError):
        repo.insert_article(
            _article(
                title="Different title",
                article_text="Different body text for the same canonical URL.",
                content_hash=content_hash("Different title", "Different body text for the same canonical URL."),
            )
        )


def test_duplicate_content_hash(repo: ArticleRepository) -> None:
    first = _article()
    repo.insert_article(first)
    with pytest.raises(sqlite3.IntegrityError):
        repo.insert_article(
            _article(
                source_url="https://dailyvoice.co.za/news/2026-09-21-mirror/",
                canonical_url="https://dailyvoice.co.za/news/2026-09-21-mirror/",
                content_hash=first.content_hash,
            )
        )


def test_article_count(repo: ArticleRepository) -> None:
    repo.insert_article(_article())
    repo.insert_article(
        _article(
            source_url="https://dailyvoice.co.za/news/2026-09-20-second/",
            canonical_url="https://dailyvoice.co.za/news/2026-09-20-second/",
            title="Second",
            article_text="Another body",
            content_hash=content_hash("Second", "Another body"),
        )
    )
    assert repo.get_article_count() == 2
