# Daily Voice scraper — agent rules

Scope: `backend/workers/dailyvoice_scraper/` only. Do not mix this Python worker with the Expo app under `app/` or the existing API under `backend/code/` unless a task explicitly requires it.

## Purpose

Collect public Daily Voice news articles (crime coverage lives on `/news/`, not a dedicated crime section) into SQLite for research. Prefer small, delayed crawls. Never treat stored rows as official SAPS statistics.

## Architecture

Keep the pipeline as:

`CLI → config → HTTP client → NewsSource (discover + parse) → validation → classification/location → ArticleRepository → stats`

Cleaning is a **separate** stage:

`raw articles → cleaning pipeline → cleaned_articles / incidents / review_queue`

Never overwrite `articles`. Geocoding and heatmaps are later stages.

- Put SQL only in `database.py` (scrape tables) and `cleaning/store.py` (cleaning-layer writes).
- Put Daily Voice selectors/metadata strategy only in `parser.py` and `sources/daily_voice.py`.
- Put URL canonicalization in `urls.py`.
- Put crime classification for cleaning in `cleaning/crime_classifier.py`.
- New publishers (News24, IOL, GroundUp, The Citizen, SAPS) get a new `NewsSource` implementation. Do not fork the repository or CLI for each site.
- Do not collapse this into a single scraper script.

## Hard rules

- Target Python 3.12+ with type hints on public functions.
- Unit tests must use fixtures under `tests/fixtures/`. Do not depend on the live website in pytest.
- Do not bypass robots.txt, CAPTCHA, Cloudflare challenges, authentication, paywalls, or `/api/` (disallowed).
- Do not add concurrency. Keep a configurable delay between requests.
- Do not invent missing fields. Use `NULL` / `None`.
- Do not store full copyrighted HTML in SQLite. Fixtures should be the minimum markup needed to test parsers.
- Do not commit secrets, cookies, or tokens. No `.env` unless credentials become necessary.
- Do not claim a live scrape or test run succeeded unless it was actually executed.
- Crime types are keyword labels, not SAPS codes. Uncertain classification stays `None` or low-confidence `other`.
- Incident location must come from incident-context phrasing, not a passing city mention.

## Website notes (inspected 2026-09-20)

- Listing: `https://dailyvoice.co.za/news/`
- Articles: `/news/{optional-section}/{YYYY-MM-DD}-{slug}/`
- Prefer JSON-LD `NewsArticle`, canonical URL, OpenGraph, then CSS-module prefix fallbacks (`article-link`, `article_content__`, `author-text`).
- Listing pagination is JS “Load more”. Extra discovery uses the public sitemap `https://dailyvoice.co.za/sitemap/daily-voice/news/`.
- Sitemap paths include `/daily-voice/`; public canonical paths do not. Normalize before insert.

## Testing and runs

- After parser or HTTP changes, run `pytest` from this project (or `./run.sh test`).
- Live checks must be conservative: `--max-pages 1 --max-articles 5` unless the user asks otherwise.
- After a scrape, verify rows with SQLite (`SELECT COUNT(*) FROM articles`) and run a second scrape to confirm deduplication.
- After cleaning, run `python -m dailyvoice_scraper.cli clean` twice and confirm `cleaned_articles` / `incidents` counts do not grow. Confirm `articles` fingerprints are unchanged.
- Do not call external geocoding APIs from the cleaning stage.

## Working style

- Change the smallest set of modules that implements the request.
- If Daily Voice markup changes, update `parser.py` comments and fixtures together.
- Keep `run.sh` free of `sudo` and global installs.
