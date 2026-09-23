"""Scheduled worker: `python -m deadman.worker` (loop) or `--once` (cron-friendly).

Every step is idempotent, so running several workers, or re-running after a crash,
cannot create duplicate events or notifications.
"""

from __future__ import annotations

import argparse
import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime

from deadman.config import Settings
from deadman.db import connect
from deadman.engine import process_expired
from deadman.geocoding import ReverseGeocoder
from deadman.notifications.dispatcher import Dispatcher, DispatchSummary
from deadman.retention import CleanupSummary, run_cleanup
from deadman.services import build_dispatcher, build_geocoder
from deadman.timeutil import utc_now

logger = logging.getLogger("deadman.worker")


@dataclass(frozen=True)
class WorkerReport:
    triggered_events: list[str]
    dispatch: DispatchSummary
    cleanup: CleanupSummary


def run_once(
    connection: sqlite3.Connection,
    *,
    settings: Settings,
    dispatcher: Dispatcher,
    geocoder: ReverseGeocoder,
    now: datetime,
) -> WorkerReport:
    triggered = process_expired(connection, now, settings, geocoder)
    dispatch = dispatcher.dispatch_pending(connection, now)
    cleanup = run_cleanup(connection, now, settings)
    return WorkerReport(triggered_events=triggered, dispatch=dispatch, cleanup=cleanup)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Travel Safe worker")
    parser.add_argument("--once", action="store_true", help="run a single pass and exit")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    settings = Settings.from_env()
    connection = connect(settings.db_path)
    dispatcher = build_dispatcher(settings)
    geocoder = build_geocoder(settings)
    while True:
        try:
            report = run_once(connection, settings=settings, dispatcher=dispatcher, geocoder=geocoder, now=utc_now())
            logger.info(
                "pass complete: triggered=%d sent=%d failed=%d cleanup=%s",
                len(report.triggered_events),
                len(report.dispatch.sent),
                len(report.dispatch.failed),
                report.cleanup,
            )
        except Exception:
            logger.exception("worker pass failed")
            if args.once:
                raise
        if args.once:
            return
        time.sleep(settings.worker_interval_seconds)


if __name__ == "__main__":
    main()
