"""Quality report for the cleaning layer."""

from __future__ import annotations

from dailyvoice_scraper.cleaning.store import CleaningStore
from dailyvoice_scraper.database import ArticleRepository


def format_cleaning_report(repository: ArticleRepository, store: CleaningStore) -> str:
    raw = repository.get_article_count()
    statuses = store.status_counts()
    processed = store.count("cleaned_articles")
    crimes = store.crime_type_counts()
    locations = store.location_stats()
    dates = store.incident_date_stats()
    duplicates = store.potential_duplicate_count()

    def line(label: str, value: int, width: int = 28) -> str:
        return f"{label:<{width}}{value:>10,}"

    crime_lines = "\n".join(
        f"  {name+':':<26}{count:>10,}" for name, count in sorted(crimes.items(), key=lambda item: (-item[1], item[0]))
    ) or "  (none)"
    return (
        "===============================\n"
        "Daily Voice Cleaning Report\n"
        "===============================\n\n"
        f"{line('Raw articles:', raw)}\n\n"
        f"{line('Processed:', processed)}\n"
        f"{line('Successfully cleaned:', statuses.get('clean', 0))}\n"
        f"{line('Needs review:', statuses.get('needs_review', 0))}\n"
        f"{line('Failed:', statuses.get('failed', 0))}\n\n"
        "Crime classification:\n"
        f"{crime_lines}\n\n"
        "Location:\n"
        f"{line('  identified:', locations['identified'], 26)}\n"
        f"{line('  ambiguous:', locations['ambiguous'], 26)}\n"
        f"{line('  missing:', locations['missing'], 26)}\n\n"
        "Incident dates:\n"
        f"{line('  identified:', dates['identified'], 26)}\n"
        f"{line('  missing:', dates['missing'], 26)}\n\n"
        f"{line('Potential duplicate incidents:', duplicates)}\n"
        "================================\n"
        "\nThese figures describe incidents reported in Daily Voice copy and\n"
        "successfully extracted by this pipeline. They are not official crime\n"
        "statistics and must not be treated as total or actual crime prevalence.\n"
    )
