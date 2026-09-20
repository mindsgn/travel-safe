"""SQLite schema and repository. All SQL stays in this module."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from dailyvoice_scraper.models import Article, CrimeIncident

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    canonical_url TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT,
    published_at TEXT,
    published_at_raw TEXT,
    updated_at TEXT,
    category TEXT,
    tags TEXT,
    location TEXT,
    article_text TEXT NOT NULL,
    image_url TEXT,
    scraped_at TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    UNIQUE (canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_articles_canonical_url ON articles(canonical_url);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);

CREATE TABLE IF NOT EXISTS crime_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    crime_type TEXT,
    crime_type_confidence REAL,
    location TEXT,
    province TEXT,
    city TEXT,
    suburb TEXT,
    police_station TEXT,
    incident_date TEXT,
    victim_count INTEGER,
    suspect_count INTEGER,
    extraction_confidence REAL,
    FOREIGN KEY(article_id) REFERENCES articles(id)
);

CREATE INDEX IF NOT EXISTS idx_crime_incidents_article_id ON crime_incidents(article_id);

CREATE TABLE IF NOT EXISTS cleaned_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_article_id INTEGER NOT NULL UNIQUE,
    title TEXT,
    normalized_title TEXT,
    author TEXT,
    published_at TEXT,
    updated_at TEXT,
    article_text TEXT,
    normalized_text TEXT,
    category TEXT,
    tags TEXT,
    source_url TEXT,
    canonical_url TEXT,
    content_hash TEXT,
    duplicate_status TEXT,
    cleaning_status TEXT NOT NULL,
    cleaning_errors TEXT,
    cleaned_at TEXT NOT NULL,
    FOREIGN KEY(raw_article_id) REFERENCES articles(id)
);

CREATE INDEX IF NOT EXISTS idx_cleaned_articles_status ON cleaned_articles(cleaning_status);
CREATE INDEX IF NOT EXISTS idx_cleaned_articles_canonical ON cleaned_articles(canonical_url);
CREATE INDEX IF NOT EXISTS idx_cleaned_articles_hash ON cleaned_articles(content_hash);

CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_date TEXT,
    crime_type TEXT,
    crime_type_original TEXT,
    province TEXT,
    municipality TEXT,
    city TEXT,
    suburb TEXT,
    location_text TEXT,
    latitude REAL,
    longitude REAL,
    location_precision TEXT,
    victim_count INTEGER,
    suspect_count INTEGER,
    description TEXT,
    extraction_confidence REAL,
    date_confidence REAL,
    crime_type_confidence REAL,
    location_confidence REAL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_crime_type ON incidents(crime_type);
CREATE INDEX IF NOT EXISTS idx_incidents_suburb ON incidents(suburb);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

CREATE TABLE IF NOT EXISTS incident_articles (
    incident_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    relationship TEXT,
    PRIMARY KEY (incident_id, article_id),
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    province TEXT,
    municipality TEXT,
    city TEXT,
    suburb TEXT,
    latitude REAL,
    longitude REAL,
    precision TEXT,
    confidence REAL,
    geocoding_status TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(normalized_name, province, city, suburb)
);

CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL,
    created_at TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_queue_open ON review_queue(resolved, record_type);

CREATE TABLE IF NOT EXISTS cleaning_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT,
    normalized_value TEXT,
    rule_applied TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_duplicates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id_a INTEGER NOT NULL,
    incident_id_b INTEGER NOT NULL,
    score REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(incident_id_a, incident_id_b),
    FOREIGN KEY(incident_id_a) REFERENCES incidents(id),
    FOREIGN KEY(incident_id_b) REFERENCES incidents(id)
);
"""


class ArticleRepository:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(self.path)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA foreign_keys = ON")

    def initialize(self) -> None:
        self._connection.executescript(SCHEMA_SQL)
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        try:
            yield self._connection
            self._connection.commit()
        except Exception:
            self._connection.rollback()
            raise

    def article_exists(self, canonical_url: str) -> bool:
        row = self._connection.execute(
            "SELECT 1 FROM articles WHERE canonical_url = ? LIMIT 1",
            (canonical_url,),
        ).fetchone()
        return row is not None

    def content_hash_exists(self, content_hash: str) -> bool:
        row = self._connection.execute(
            "SELECT 1 FROM articles WHERE content_hash = ? LIMIT 1",
            (content_hash,),
        ).fetchone()
        return row is not None

    def insert_article(self, article: Article) -> int:
        with self.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO articles (
                    source, source_url, canonical_url, title, subtitle, author,
                    published_at, published_at_raw, updated_at, category, tags,
                    location, article_text, image_url, scraped_at, content_hash
                ) VALUES (
                    :source, :source_url, :canonical_url, :title, :subtitle, :author,
                    :published_at, :published_at_raw, :updated_at, :category, :tags,
                    :location, :article_text, :image_url, :scraped_at, :content_hash
                )
                """,
                {
                    "source": article.source,
                    "source_url": article.source_url,
                    "canonical_url": article.canonical_url,
                    "title": article.title,
                    "subtitle": article.subtitle,
                    "author": article.author,
                    "published_at": article.published_at,
                    "published_at_raw": article.published_at_raw,
                    "updated_at": article.updated_at,
                    "category": article.category,
                    "tags": article.tags,
                    "location": article.location,
                    "article_text": article.article_text,
                    "image_url": article.image_url,
                    "scraped_at": article.scraped_at,
                    "content_hash": article.content_hash,
                },
            )
            article_id = int(cursor.lastrowid)
        article.id = article_id
        return article_id

    def insert_incident(self, incident: CrimeIncident) -> int:
        with self.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO crime_incidents (
                    article_id, crime_type, crime_type_confidence, location,
                    province, city, suburb, police_station, incident_date,
                    victim_count, suspect_count, extraction_confidence
                ) VALUES (
                    :article_id, :crime_type, :crime_type_confidence, :location,
                    :province, :city, :suburb, :police_station, :incident_date,
                    :victim_count, :suspect_count, :extraction_confidence
                )
                """,
                {
                    "article_id": incident.article_id,
                    "crime_type": incident.crime_type,
                    "crime_type_confidence": incident.crime_type_confidence,
                    "location": incident.location,
                    "province": incident.province,
                    "city": incident.city,
                    "suburb": incident.suburb,
                    "police_station": incident.police_station,
                    "incident_date": incident.incident_date,
                    "victim_count": incident.victim_count,
                    "suspect_count": incident.suspect_count,
                    "extraction_confidence": incident.extraction_confidence,
                },
            )
            return int(cursor.lastrowid)

    def get_article(self, article_id: int) -> Article | None:
        row = self._connection.execute(
            "SELECT * FROM articles WHERE id = ?",
            (article_id,),
        ).fetchone()
        return _row_to_article(row) if row else None

    def get_articles(self, limit: int = 100) -> list[Article]:
        rows = self._connection.execute(
            "SELECT * FROM articles ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [_row_to_article(row) for row in rows]

    def get_article_count(self) -> int:
        row = self._connection.execute("SELECT COUNT(*) AS n FROM articles").fetchone()
        return int(row["n"]) if row else 0

    def iter_raw_articles(self, *, limit: int | None = None, only_uncleaned: bool = False) -> list[Article]:
        sql = "SELECT articles.* FROM articles"
        params: list[object] = []
        if only_uncleaned:
            sql += (
                " LEFT JOIN cleaned_articles ON cleaned_articles.raw_article_id = articles.id"
                " WHERE cleaned_articles.id IS NULL"
            )
        sql += " ORDER BY articles.id ASC"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        rows = self._connection.execute(sql, params).fetchall()
        return [_row_to_article(row) for row in rows]

    def raw_articles_fingerprint(self) -> tuple[int, str]:
        """Count plus hash of raw rows. Used to prove cleaning does not mutate scrape data."""
        count = self.get_article_count()
        row = self._connection.execute(
            "SELECT COALESCE(GROUP_CONCAT(id || ':' || content_hash, '|'), '') AS fp FROM articles"
        ).fetchone()
        return count, str(row["fp"] if row else "")


def _row_to_article(row: sqlite3.Row) -> Article:
    return Article(
        id=row["id"],
        source=row["source"],
        source_url=row["source_url"],
        canonical_url=row["canonical_url"],
        title=row["title"],
        subtitle=row["subtitle"],
        author=row["author"],
        published_at=row["published_at"],
        published_at_raw=row["published_at_raw"],
        updated_at=row["updated_at"],
        category=row["category"],
        tags=row["tags"],
        location=row["location"],
        article_text=row["article_text"],
        image_url=row["image_url"],
        scraped_at=row["scraped_at"],
        content_hash=row["content_hash"],
    )
