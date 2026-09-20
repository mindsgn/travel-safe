"""Cleaning-layer persistence. Never writes to the raw ``articles`` table."""

from __future__ import annotations

import sqlite3
from typing import Any

from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.dates import utc_now_iso


class CleaningStore:
    def __init__(self, repository: ArticleRepository) -> None:
        self._connection = repository._connection
        self._repository = repository

    def cleaned_exists(self, raw_article_id: int) -> bool:
        row = self._connection.execute(
            "SELECT 1 FROM cleaned_articles WHERE raw_article_id = ? LIMIT 1",
            (raw_article_id,),
        ).fetchone()
        return row is not None

    def insert_cleaned_article(self, payload: dict[str, Any]) -> int:
        columns = ", ".join(payload.keys())
        placeholders = ", ".join(f":{key}" for key in payload)
        with self._repository.transaction():
            cursor = self._connection.execute(
                f"INSERT INTO cleaned_articles ({columns}) VALUES ({placeholders})",
                payload,
            )
            return int(cursor.lastrowid)

    def insert_incident(self, payload: dict[str, Any]) -> int:
        columns = ", ".join(payload.keys())
        placeholders = ", ".join(f":{key}" for key in payload)
        with self._repository.transaction():
            cursor = self._connection.execute(
                f"INSERT INTO incidents ({columns}) VALUES ({placeholders})",
                payload,
            )
            return int(cursor.lastrowid)

    def link_incident_article(self, incident_id: int, article_id: int, relationship: str) -> None:
        with self._repository.transaction():
            self._connection.execute(
                """
                INSERT OR IGNORE INTO incident_articles (incident_id, article_id, relationship)
                VALUES (?, ?, ?)
                """,
                (incident_id, article_id, relationship),
            )

    def upsert_location(self, payload: dict[str, Any]) -> int:
        existing = self._connection.execute(
            """
            SELECT id FROM locations
            WHERE normalized_name IS ? AND province IS ? AND city IS ? AND suburb IS ?
            LIMIT 1
            """,
            (
                payload["normalized_name"],
                payload.get("province"),
                payload.get("city"),
                payload.get("suburb"),
            ),
        ).fetchone()
        if existing:
            return int(existing["id"])
        with self._repository.transaction():
            cursor = self._connection.execute(
                """
                INSERT INTO locations (
                    original_text, normalized_name, province, municipality, city, suburb,
                    latitude, longitude, precision, confidence, geocoding_status, created_at
                ) VALUES (
                    :original_text, :normalized_name, :province, :municipality, :city, :suburb,
                    :latitude, :longitude, :precision, :confidence, :geocoding_status, :created_at
                )
                """,
                payload,
            )
            return int(cursor.lastrowid)

    def insert_review(self, record_type: str, record_id: int, reason: str, confidence: float | None) -> None:
        with self._repository.transaction():
            self._connection.execute(
                """
                INSERT INTO review_queue (record_type, record_id, reason, confidence, created_at, resolved)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                (record_type, record_id, reason, confidence, utc_now_iso()),
            )

    def insert_audit(
        self,
        record_type: str,
        record_id: int,
        field_name: str,
        original_value: str | None,
        normalized_value: str | None,
        rule_applied: str,
    ) -> None:
        with self._repository.transaction():
            self._connection.execute(
                """
                INSERT INTO cleaning_audit (
                    record_type, record_id, field_name, original_value, normalized_value,
                    rule_applied, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_type,
                    record_id,
                    field_name,
                    original_value,
                    normalized_value,
                    rule_applied,
                    utc_now_iso(),
                ),
            )

    def insert_incident_duplicate(
        self, incident_id_a: int, incident_id_b: int, score: float, reason: str, status: str
    ) -> None:
        left, right = sorted((incident_id_a, incident_id_b))
        with self._repository.transaction():
            self._connection.execute(
                """
                INSERT OR IGNORE INTO incident_duplicates (
                    incident_id_a, incident_id_b, score, reason, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (left, right, score, reason, status, utc_now_iso()),
            )

    def list_incidents(self) -> list[sqlite3.Row]:
        return list(self._connection.execute("SELECT * FROM incidents ORDER BY id ASC").fetchall())

    def list_cleaned(self) -> list[sqlite3.Row]:
        return list(self._connection.execute("SELECT * FROM cleaned_articles ORDER BY id ASC").fetchall())

    def list_open_reviews(self, limit: int = 100) -> list[sqlite3.Row]:
        return list(
            self._connection.execute(
                "SELECT * FROM review_queue WHERE resolved = 0 ORDER BY id ASC LIMIT ?",
                (limit,),
            ).fetchall()
        )

    def count(self, table: str) -> int:
        row = self._connection.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
        return int(row["n"]) if row else 0

    def crime_type_counts(self) -> dict[str, int]:
        rows = self._connection.execute(
            """
            SELECT COALESCE(crime_type, 'unknown') AS crime_type, COUNT(*) AS n
            FROM incidents
            GROUP BY COALESCE(crime_type, 'unknown')
            """
        ).fetchall()
        return {str(row["crime_type"]): int(row["n"]) for row in rows}

    def status_counts(self) -> dict[str, int]:
        rows = self._connection.execute(
            "SELECT cleaning_status, COUNT(*) AS n FROM cleaned_articles GROUP BY cleaning_status"
        ).fetchall()
        return {str(row["cleaning_status"]): int(row["n"]) for row in rows}

    def location_stats(self) -> dict[str, int]:
        identified = self._connection.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE suburb IS NOT NULL OR city IS NOT NULL"
        ).fetchone()["n"]
        missing = self._connection.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE location_text IS NULL AND suburb IS NULL AND city IS NULL"
        ).fetchone()["n"]
        ambiguous = self._connection.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE location_confidence IS NOT NULL AND location_confidence < 0.7"
            " AND (suburb IS NOT NULL OR city IS NOT NULL OR location_text IS NOT NULL)"
        ).fetchone()["n"]
        return {
            "identified": int(identified),
            "ambiguous": int(ambiguous),
            "missing": int(missing),
        }

    def incident_date_stats(self) -> dict[str, int]:
        identified = self._connection.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE incident_date IS NOT NULL"
        ).fetchone()["n"]
        missing = self._connection.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE incident_date IS NULL"
        ).fetchone()["n"]
        return {"identified": int(identified), "missing": int(missing)}

    def potential_duplicate_count(self) -> int:
        row = self._connection.execute("SELECT COUNT(*) AS n FROM incident_duplicates").fetchone()
        return int(row["n"]) if row else 0

    def remove_cleaning_for_articles(self, article_ids: list[int]) -> None:
        """Drop cleaning-layer rows for selected articles. Never touches ``articles``."""
        if not article_ids:
            return
        placeholders = ",".join("?" for _ in article_ids)
        with self._repository.transaction():
            incident_rows = self._connection.execute(
                f"SELECT incident_id FROM incident_articles WHERE article_id IN ({placeholders})",
                article_ids,
            ).fetchall()
            incident_ids = [int(row["incident_id"]) for row in incident_rows]
            self._connection.execute(
                f"DELETE FROM incident_articles WHERE article_id IN ({placeholders})",
                article_ids,
            )
            for incident_id in incident_ids:
                remaining = self._connection.execute(
                    "SELECT 1 FROM incident_articles WHERE incident_id = ? LIMIT 1",
                    (incident_id,),
                ).fetchone()
                if remaining:
                    continue
                self._connection.execute(
                    "DELETE FROM incident_duplicates WHERE incident_id_a = ? OR incident_id_b = ?",
                    (incident_id, incident_id),
                )
                self._connection.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
                self._connection.execute(
                    "DELETE FROM review_queue WHERE record_type = 'incident' AND record_id = ?",
                    (incident_id,),
                )
            cleaned_rows = self._connection.execute(
                f"SELECT id FROM cleaned_articles WHERE raw_article_id IN ({placeholders})",
                article_ids,
            ).fetchall()
            cleaned_ids = [int(row["id"]) for row in cleaned_rows]
            self._connection.execute(
                f"DELETE FROM cleaned_articles WHERE raw_article_id IN ({placeholders})",
                article_ids,
            )
            for cleaned_id in cleaned_ids:
                self._connection.execute(
                    "DELETE FROM review_queue WHERE record_type = 'cleaned_article' AND record_id = ?",
                    (cleaned_id,),
                )
                self._connection.execute(
                    "DELETE FROM cleaning_audit WHERE record_type = 'cleaned_article' AND record_id = ?",
                    (cleaned_id,),
                )
