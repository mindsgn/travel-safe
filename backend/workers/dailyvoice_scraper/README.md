# Daily Voice crime/news scraper

Python scraper that collects **Daily Voice** news articles (including crime coverage) from the public website and stores cleaned article text in **SQLite**.

The first source is Daily Voice only. HTTP, parsing, classification, and persistence are separate modules so additional South African news sites can be added later without rewriting the pipeline.

This is a research collector for news reports. It is **not** a source of official SAPS crime statistics.

## Requirements

- Python 3.12+
- bash (for `run.sh`)

## Installation

```bash
git clone <this-repository>
cd backend/workers/dailyvoice_scraper
./run.sh
```

`./run.sh` creates a virtual environment, installs dependencies locally (never with `sudo`), initializes SQLite, runs unit tests, then performs a small scrape.

Useful subcommands:

```bash
./run.sh test
./run.sh init-db
./run.sh scrape
```

## Configuration

Copy `config.example.yaml` to `config.yaml` if you want a local override. CLI flags win over YAML.

| Key | Purpose |
| --- | --- |
| `site.crime_url` | Public listing used as the start URL. Daily Voice does not publish a dedicated `/crime` section; crime stories appear on `https://dailyvoice.co.za/news/`. |
| `site.sitemap_url` | Public news sitemap from `robots.txt`. Used when `max_pages` is greater than 1 because listing pagination is a JavaScript **Load more** control and `/api/` is disallowed by robots.txt. |
| `scraper.request_delay_seconds` | Delay between HTTP requests (default 2). |
| `scraper.max_pages` / `max_articles` | Conservative caps. |
| `scraper.user_agent` | Descriptive User-Agent. |
| `database.path` | SQLite file, default `data/dailyvoice.sqlite3`. |

Examples:

```bash
python -m dailyvoice_scraper.cli scrape --max-pages 1 --max-articles 5
python -m dailyvoice_scraper.cli init-db
python -m dailyvoice_scraper.cli test-connection
python -m dailyvoice_scraper.cli clean
python -m dailyvoice_scraper.cli validate
python -m dailyvoice_scraper.cli deduplicate
python -m dailyvoice_scraper.cli review
python -m dailyvoice_scraper.cli export
```

Exit codes: `0` success, `1` runtime/HTTP failure, `2` usage or configuration error.

## Stages

```
1. scrape
      ↓
2. clean / classify / deduplicate
      ↓
3. geocode          (not implemented yet)
      ↓
4. spatial analysis / heatmaps  (not implemented yet)
```

Cleaning never overwrites `articles`. If location rules change later, rerun `clean --reprocess` without hitting Daily Voice.

## How discovery works

Inspected against the live site on 2026-09-20:

- Homepage: `https://dailyvoice.co.za`
- News listing: `https://dailyvoice.co.za/news/`
- Article pattern: `/news/{optional-section}/{YYYY-MM-DD}-{slug}/`
- Canonical links use `/news/...`; the sitemap uses `/daily-voice/news/...`. Both are normalized to the public `/news/` form.
- Article pages expose `NewsArticle` JSON-LD, OpenGraph, `<h1>`, and body copy in `[class*="article_content__"]`.
- Listing “Load more” is client-side. This scraper does **not** call `/api/` or bypass Cloudflare/CAPTCHA.

## Database

SQLite file: `data/dailyvoice.sqlite3`

### `articles`

Raw scraped rows. Never updated by the cleaning pipeline.

### `crime_incidents`

Optional first-pass extraction written **during scrape**. Kept for compatibility. The cleaning pipeline writes a separate `incidents` table instead of mutating these rows.

### Cleaning layer

| Table | Role |
| --- | --- |
| `cleaned_articles` | Normalized copy of each raw article (`raw_article_id` unique). |
| `incidents` | Extracted incident candidates. One article is not assumed to be one unique crime. |
| `incident_articles` | Many-to-many links. |
| `locations` | Normalized place cache for a later geocoding stage. `latitude`/`longitude` stay NULL for now. |
| `review_queue` | Ambiguous locations, potential duplicates, validation failures. |
| `cleaning_audit` | Original value, normalized value, rule, timestamp. |
| `incident_duplicates` | Scored possible/probable matches. Records are **not** merged automatically. |

Statuses: `pending`, `clean`, `needs_review`, `failed`, `excluded`.

Confidence scores (`date_confidence`, `crime_type_confidence`, `location_confidence`, `extraction_confidence`) measure **extraction certainty**, not the probability that a crime occurred.

Crime types are a local vocabulary (`murder`, `armed_robbery`, …). They are not SAPS codes.

Inspect:

```bash
sqlite3 data/dailyvoice.sqlite3
```

```sql
SELECT COUNT(*) FROM articles;

SELECT title, published_at
FROM articles
ORDER BY published_at DESC
LIMIT 20;

SELECT cleaning_status, COUNT(*) FROM cleaned_articles GROUP BY cleaning_status;

SELECT crime_type, suburb, incident_date, extraction_confidence
FROM incidents
ORDER BY id DESC
LIMIT 20;
```

These figures describe **incidents reported by Daily Voice and successfully extracted**. They are not all crime, total crime, official statistics, or actual prevalence. News coverage is biased.

## Running tests

Tests use saved HTML fixtures and a temporary SQLite file. They do not hit Daily Voice.

```bash
source .venv/bin/activate
pytest
pytest --cov=dailyvoice_scraper
```

## Legal and ethical considerations

- **robots.txt**: `User-agent: *` allows `/`. `/api/`, `/_next/` (except static), `/private/`, and search queries are disallowed and are not requested. Several AI-training bots are disallowed; this project uses a research User-Agent under the general `*` rule and stays on public HTML/sitemap URLs.
- **Terms of service**: Re-read Daily Voice / Independent Media terms before any production-scale crawl. This tool is for small, delayed, personal/research collection.
- **Rate limiting**: Default delay is 2 seconds. There is no concurrent fetching.
- **Copyright**: Article text is stored for local research. Do not republish scraped copy. Full HTML snapshots are not kept in the database.
- **Personal information**: Crime reports name victims, suspects, and witnesses. Treat the SQLite file as sensitive.
- **News vs statistics**: Headlines are not official crime stats. Classification labels are keyword guesses, not SAPS categories.

## Project layout

```
src/dailyvoice_scraper/
  http_client.py   # timeouts, retries, delay, 429 Retry-After
  parser.py        # HTML/JSON-LD → Article
  sources/         # NewsSource implementations
  pipeline.py      # scrape: discover → fetch → validate → store
  cleaning/        # independent clean / classify / dedupe pipeline
  database.py      # parameterized SQL for scrape + cleaning tables
```

## Next Steps

The pipeline already talks to a `NewsSource` protocol instead of Daily Voice SQL. To add another South African publisher later:

1. Add `src/dailyvoice_scraper/sources/news24.py` (or `iol.py`, `citizen.py`, `groundup.py`, `saps.py`) that implements `discover_articles` and `parse_article`.
2. Put that site’s selectors and JSON-LD rules in its own parser module. Do not grow `parser.py` into a multi-site switch.
3. Add a `sources:` list in YAML so the CLI can run one source or several.
4. Keep sharing `HttpClient`, `ArticleRepository`, validation, hashing, and crime/location extractors.
5. Save HTML fixtures per site under `tests/fixtures/<source>/`.
6. Re-check each site’s `robots.txt` before enabling it. Do not scrape `/api/` or bypass access controls.

Crime extraction can later gain gazetteer-backed locations and optional human review. Do not introduce an LLM classifier unless explicitly requested.
