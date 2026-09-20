"""Command-line interface."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from dailyvoice_scraper.config import load_config
from dailyvoice_scraper.cleaning.export import export_incidents_csv
from dailyvoice_scraper.cleaning.pipeline import CleaningPipeline
from dailyvoice_scraper.cleaning.report import format_cleaning_report
from dailyvoice_scraper.database import ArticleRepository
from dailyvoice_scraper.exceptions import ConfigurationError, HttpClientError
from dailyvoice_scraper.logging_config import configure_logging
from dailyvoice_scraper.scraper import Scraper

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Daily Voice crime/news scraper")
    parser.add_argument("--config", type=Path, default=None, help="Path to YAML config")
    parser.add_argument("--log-level", default=None, help="Logging level (default from config)")
    sub = parser.add_subparsers(dest="command", required=True)

    scrape = sub.add_parser("scrape", help="Discover and store articles")
    scrape.add_argument("--max-pages", type=int, default=None)
    scrape.add_argument("--max-articles", type=int, default=None)
    scrape.add_argument("--database", type=Path, default=None)
    scrape.add_argument("--force", action="store_true", help="Re-download even if URL exists")

    sub.add_parser("init-db", help="Create SQLite tables")
    sub.add_parser("test-connection", help="Fetch the listing URL and report status")

    clean = sub.add_parser("clean", help="Normalize raw articles into cleaned records and incidents")
    clean.add_argument("--limit", type=int, default=None)
    clean.add_argument("--reprocess", action="store_true", help="Rebuild cleaned rows from raw articles")
    clean.add_argument("--database", type=Path, default=None)

    sub.add_parser("validate", help="Re-run validation on cleaned incidents")
    sub.add_parser("deduplicate", help="Score potential duplicate incidents without merging")
    review = sub.add_parser("review", help="Print open review-queue items")
    review.add_argument("--limit", type=int, default=50)
    export_cmd = sub.add_parser("export", help="Export cleaned incidents to CSV")
    export_cmd.add_argument("--output", type=Path, default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    project_root = Path(__file__).resolve().parents[2]
    try:
        config = load_config(
            args.config,
            project_root=project_root,
            max_pages=getattr(args, "max_pages", None),
            max_articles=getattr(args, "max_articles", None),
            database_path=getattr(args, "database", None),
            log_level=args.log_level,
            force_rescrape=getattr(args, "force", None),
        )
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    configure_logging(config.logging.level)

    if args.command == "init-db":
        repo = ArticleRepository(config.database.path)
        repo.initialize()
        repo.close()
        logger.info("Initialized database at %s", config.database.path)
        return 0

    if args.command in {"test-connection", "scrape"}:
        scraper = Scraper(config)
        if args.command == "test-connection":
            try:
                ok = scraper.test_connection()
            except HttpClientError as exc:
                logger.error("%s", exc)
                return 1
            if not ok:
                logger.error("Connection test failed")
                return 1
            logger.info("Connection test succeeded")
            return 0
        stats = scraper.scrape()
        print(stats.format_summary())
        return 0

    repo = ArticleRepository(config.database.path)
    repo.initialize()
    try:
        pipeline = CleaningPipeline(config, repo)
        store = pipeline.store
        if args.command == "clean":
            pipeline.run(limit=args.limit, reprocess=args.reprocess)
            print(format_cleaning_report(repo, store))
            return 0
        if args.command == "validate":
            failures = pipeline.validate_existing()
            print(f"Validation issues recorded: {failures}")
            print(format_cleaning_report(repo, store))
            return 0
        if args.command == "deduplicate":
            created = pipeline.deduplicate_existing()
            print(f"Potential duplicate pairs stored: {created}")
            return 0
        if args.command == "review":
            rows = store.list_open_reviews(limit=args.limit)
            if not rows:
                print("Review queue is empty.")
                return 0
            for row in rows:
                print(
                    f"{row['id']}\t{row['record_type']}\t{row['record_id']}\t"
                    f"{row['reason']}\tconfidence={row['confidence']}"
                )
            return 0
        if args.command == "export":
            output = args.output or (config.cleaning.export_dir / "incidents.csv")
            path = export_incidents_csv(store, output)
            print(f"Wrote {path}")
            return 0
    finally:
        repo.close()

    return 2


if __name__ == "__main__":
    sys.exit(main())
