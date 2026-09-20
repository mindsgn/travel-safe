"""CSV export of cleaned incidents. Does not include raw article text."""

from __future__ import annotations

import csv
from pathlib import Path

from dailyvoice_scraper.cleaning.store import CleaningStore

EXPORT_COLUMNS = [
    "incident_id",
    "incident_date",
    "crime_type",
    "province",
    "municipality",
    "city",
    "suburb",
    "location_text",
    "latitude",
    "longitude",
    "victim_count",
    "suspect_count",
    "extraction_confidence",
    "date_confidence",
    "location_confidence",
]


def export_incidents_csv(store: CleaningStore, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = store.list_incidents()
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=EXPORT_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "incident_id": row["id"],
                    "incident_date": row["incident_date"],
                    "crime_type": row["crime_type"],
                    "province": row["province"],
                    "municipality": row["municipality"],
                    "city": row["city"],
                    "suburb": row["suburb"],
                    "location_text": row["location_text"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "victim_count": row["victim_count"],
                    "suspect_count": row["suspect_count"],
                    "extraction_confidence": row["extraction_confidence"],
                    "date_confidence": row["date_confidence"],
                    "location_confidence": row["location_confidence"],
                }
            )
    return path
