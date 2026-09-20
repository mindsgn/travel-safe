"""Independent cleaning pipeline. Never mutates raw ``articles`` rows."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from dailyvoice_scraper.cleaning.confidence import combine_confidence
from dailyvoice_scraper.cleaning.crime_classifier import classify_crime, extract_counts
from dailyvoice_scraper.cleaning.dates import extract_incident_date
from dailyvoice_scraper.cleaning.deduplication import (
    article_duplicate_status,
    score_incident_pair,
)
from dailyvoice_scraper.cleaning.locations import extract_locations
from dailyvoice_scraper.cleaning.store import CleaningStore
from dailyvoice_scraper.cleaning.text import description_excerpt, normalize_text, normalize_title
from dailyvoice_scraper.cleaning.validation import validate_incident
from dailyvoice_scraper.config import AppConfig
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.dates import utc_now_iso
from dailyvoice_scraper.hashing import content_hash
from dailyvoice_scraper.models import Article

logger = logging.getLogger(__name__)


@dataclass
class CleaningStats:
    raw_articles: int = 0
    processed: int = 0
    skipped: int = 0
    successfully_cleaned: int = 0
    needs_review: int = 0
    failed: int = 0
    incidents_created: int = 0
    potential_duplicates: int = 0
    review_records: int = 0
    validation_failures: int = 0
    notes: list[str] = field(default_factory=list)


class CleaningPipeline:
    def __init__(self, config: AppConfig, repository: ArticleRepository) -> None:
        self.config = config
        self.repository = repository
        self.store = CleaningStore(repository)

    def run(self, *, limit: int | None = None, reprocess: bool = False) -> CleaningStats:
        stats = CleaningStats(raw_articles=self.repository.get_article_count())
        articles = self.repository.iter_raw_articles(limit=None if reprocess else limit)
        if reprocess:
            selected = articles[:limit] if limit is not None else articles
            logger.info("Reprocessing %s cleaned records from raw articles", len(selected))
            self.store.remove_cleaning_for_articles(
                [article.id for article in selected if article.id is not None]
            )
            articles = selected
        else:
            articles = self.repository.iter_raw_articles(limit=limit, only_uncleaned=True)

        existing_cleaned = [
            {
                "canonical_url": row["canonical_url"],
                "content_hash": row["content_hash"],
                "normalized_title": row["normalized_title"],
            }
            for row in self.store.list_cleaned()
        ]

        for article in articles:
            if article.id is None:
                continue
            logger.info("Cleaning article %s", article.id)
            self._clean_one(article, existing_cleaned, stats)
        return stats

    def _clean_one(
        self,
        article: Article,
        existing_cleaned: list[dict[str, str | None]],
        stats: CleaningStats,
    ) -> None:
        stats.processed += 1
        now = utc_now_iso()
        title = article.title
        body = article.article_text
        normalized_title = normalize_title(title)
        normalized_text = normalize_text(body)
        errors: list[str] = []

        if not normalized_title or not normalized_text:
            cleaned_id = self.store.insert_cleaned_article(
                {
                    "raw_article_id": article.id,
                    "title": title,
                    "normalized_title": normalized_title or None,
                    "author": article.author,
                    "published_at": article.published_at,
                    "updated_at": article.updated_at,
                    "article_text": body,
                    "normalized_text": normalized_text or None,
                    "category": article.category,
                    "tags": article.tags,
                    "source_url": article.source_url,
                    "canonical_url": article.canonical_url,
                    "content_hash": article.content_hash,
                    "duplicate_status": "unique",
                    "cleaning_status": "failed",
                    "cleaning_errors": json.dumps(["insufficient usable text"]),
                    "cleaned_at": now,
                }
            )
            self.store.insert_review("cleaned_article", cleaned_id, "Article contains insufficient usable data", 0.0)
            stats.failed += 1
            stats.review_records += 1
            logger.info("Article %s failed cleaning", article.id)
            return

        cleaned_hash = content_hash(normalized_title, normalized_text)
        dup = article_duplicate_status(
            canonical_url=article.canonical_url,
            content_hash=cleaned_hash,
            normalized_title=normalized_title,
            existing=existing_cleaned,
            similar_title_threshold=self.config.deduplication.similar_title_threshold,
        )
        classification = classify_crime(title, normalized_text)
        date_result = extract_incident_date(normalized_text, article.published_at)
        locations = extract_locations(f"{title}\n{normalized_text}")
        victims, suspects = extract_counts(f"{title}\n{normalized_text}")
        incident_loc = locations.incident

        date_confidence = date_result.confidence
        crime_confidence = classification.confidence
        location_confidence = incident_loc.confidence if incident_loc else 0.0
        has_incident = bool(classification.is_reported_incident and classification.crime_type)
        extraction_confidence = combine_confidence(
            date_confidence=date_confidence,
            crime_type_confidence=crime_confidence,
            location_confidence=location_confidence,
            has_incident=has_incident,
        )

        issues = validate_incident(
            incident_date=date_result.incident_date,
            published_at=article.published_at,
            crime_type=classification.crime_type,
            province=incident_loc.province if incident_loc else None,
            latitude=None,
            longitude=None,
            victim_count=victims,
            suspect_count=suspects,
            settings=self.config.validation,
        )
        if issues:
            stats.validation_failures += len(issues)
            errors.extend(f"{issue.field}: {issue.message}" for issue in issues)

        status = "clean"
        if extraction_confidence < self.config.cleaning.min_confidence and has_incident:
            status = "needs_review"
            errors.append("low extraction confidence")
        if locations.ambiguous:
            status = "needs_review"
            errors.append("ambiguous incident location")
        if dup.status == "potential_duplicate":
            status = "needs_review"
            errors.append("potential duplicate article")
        if issues:
            status = "needs_review"

        cleaned_id = self.store.insert_cleaned_article(
            {
                "raw_article_id": article.id,
                "title": title,
                "normalized_title": normalized_title,
                "author": article.author,
                "published_at": article.published_at,
                "updated_at": article.updated_at,
                "article_text": body,
                "normalized_text": normalized_text,
                "category": article.category,
                "tags": article.tags,
                "source_url": article.source_url,
                "canonical_url": article.canonical_url,
                "content_hash": cleaned_hash,
                "duplicate_status": dup.status,
                "cleaning_status": status,
                "cleaning_errors": json.dumps(errors) if errors else None,
                "cleaned_at": now,
            }
        )
        self.store.insert_audit(
            "cleaned_article",
            cleaned_id,
            "title",
            title,
            normalized_title,
            "title.normalize_case_punctuation",
        )
        if classification.original and classification.crime_type:
            self.store.insert_audit(
                "cleaned_article",
                cleaned_id,
                "crime_type",
                classification.original,
                classification.crime_type,
                classification.reason,
            )
        if date_result.original and date_result.incident_date:
            self.store.insert_audit(
                "cleaned_article",
                cleaned_id,
                "incident_date",
                date_result.original,
                date_result.incident_date,
                date_result.rule or "incident_date",
            )

        existing_cleaned.append(
            {
                "canonical_url": article.canonical_url,
                "content_hash": cleaned_hash,
                "normalized_title": normalized_title,
            }
        )

        if status == "clean":
            stats.successfully_cleaned += 1
        else:
            stats.needs_review += 1
            for reason in errors or ["needs review"]:
                self.store.insert_review("cleaned_article", cleaned_id, reason, extraction_confidence)
                stats.review_records += 1

        if not has_incident:
            logger.info("Article %s cleaned without an incident row", article.id)
            return

        if incident_loc and incident_loc.normalized_name:
            self.store.upsert_location(
                {
                    "original_text": incident_loc.original_text,
                    "normalized_name": incident_loc.normalized_name,
                    "province": incident_loc.province,
                    "municipality": incident_loc.municipality,
                    "city": incident_loc.city,
                    "suburb": incident_loc.suburb,
                    "latitude": None,
                    "longitude": None,
                    "precision": incident_loc.precision,
                    "confidence": incident_loc.confidence,
                    "geocoding_status": "pending",
                    "created_at": now,
                }
            )

        incident_status = "needs_review" if status != "clean" else "clean"
        incident_id = self.store.insert_incident(
            {
                "incident_date": date_result.incident_date,
                "crime_type": classification.crime_type,
                "crime_type_original": classification.original,
                "province": incident_loc.province if incident_loc else None,
                "municipality": incident_loc.municipality if incident_loc else None,
                "city": incident_loc.city if incident_loc else None,
                "suburb": incident_loc.suburb if incident_loc else None,
                "location_text": incident_loc.original_text if incident_loc else None,
                "latitude": None,
                "longitude": None,
                "location_precision": incident_loc.precision if incident_loc else None,
                "victim_count": victims,
                "suspect_count": suspects,
                "description": description_excerpt(normalized_text),
                "extraction_confidence": extraction_confidence,
                "date_confidence": date_confidence,
                "crime_type_confidence": crime_confidence,
                "location_confidence": location_confidence or None,
                "status": incident_status,
                "created_at": now,
                "updated_at": now,
            }
        )
        self.store.link_incident_article(incident_id, article.id, "source")
        stats.incidents_created += 1

        current = {
            "id": incident_id,
            "incident_date": date_result.incident_date,
            "suburb": incident_loc.suburb if incident_loc else None,
            "location_text": incident_loc.original_text if incident_loc else None,
            "crime_type": classification.crime_type,
            "victim_count": victims,
            "title": normalized_title,
            "text": normalized_text,
        }
        for row in self.store.list_incidents():
            other_id = int(row["id"])
            if other_id == incident_id:
                continue
            match = score_incident_pair(
                current,
                {
                    "id": other_id,
                    "incident_date": row["incident_date"],
                    "suburb": row["suburb"],
                    "location_text": row["location_text"],
                    "crime_type": row["crime_type"],
                    "victim_count": row["victim_count"],
                    "title": "",
                    "text": row["description"] or "",
                },
                self.config.deduplication,
            )
            if match.status == "probably_separate":
                continue
            self.store.insert_incident_duplicate(
                incident_id, other_id, match.score, match.reason, match.status
            )
            stats.potential_duplicates += 1
            self.store.insert_review(
                "incident",
                incident_id,
                f"Potential duplicate incident vs {other_id} ({match.status}, {match.score})",
                match.score,
            )
            stats.review_records += 1
        logger.info("Created incident %s for article %s", incident_id, article.id)

    def validate_existing(self) -> int:
        failures = 0
        for row in self.store.list_incidents():
            issues = validate_incident(
                incident_date=row["incident_date"],
                published_at=None,
                crime_type=row["crime_type"],
                province=row["province"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                victim_count=row["victim_count"],
                suspect_count=row["suspect_count"],
                settings=self.config.validation,
            )
            for issue in issues:
                failures += 1
                self.store.insert_review("incident", int(row["id"]), f"{issue.field}: {issue.message}", None)
        logger.info("Validation failures recorded: %s", failures)
        return failures

    def deduplicate_existing(self) -> int:
        rows = self.store.list_incidents()
        created = 0
        for index, left in enumerate(rows):
            for right in rows[index + 1 :]:
                match = score_incident_pair(
                    {
                        "id": int(left["id"]),
                        "incident_date": left["incident_date"],
                        "suburb": left["suburb"],
                        "location_text": left["location_text"],
                        "crime_type": left["crime_type"],
                        "victim_count": left["victim_count"],
                        "title": "",
                        "text": left["description"] or "",
                    },
                    {
                        "id": int(right["id"]),
                        "incident_date": right["incident_date"],
                        "suburb": right["suburb"],
                        "location_text": right["location_text"],
                        "crime_type": right["crime_type"],
                        "victim_count": right["victim_count"],
                        "title": "",
                        "text": right["description"] or "",
                    },
                    self.config.deduplication,
                )
                if match.status == "probably_separate":
                    continue
                self.store.insert_incident_duplicate(
                    int(left["id"]), int(right["id"]), match.score, match.reason, match.status
                )
                created += 1
        logger.info("Potential duplicate incident pairs: %s", created)
        return created
