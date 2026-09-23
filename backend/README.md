# Travel Safe API

Python (FastAPI) service with SQLite storage. It is the authoritative source for whether a
user's Travel Safe has triggered: the app records check-ins, and a separate worker process
detects missed deadlines and notifies emergency contacts.

## Run

```bash
cd backend/code
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in provider keys; .env is git-ignored
set -a; source .env; set +a

uvicorn app:app --reload --port 8000     # API
python -m deadman.worker                 # worker loop (every DEADMAN_WORKER_INTERVAL_SECONDS)
python -m deadman.worker --once          # single pass, e.g. from cron
```

Run the API and the worker as separate processes. Every worker job is idempotent, so running it
twice, or running two workers by mistake, never sends duplicate alerts.

## Tests

```bash
pip install ruff pytest
ruff check .
pytest -v
```

The tests cover every scenario from the specification: check-in before, exactly at, and after
the deadline; triggering and no double trigger; multiple, email-only, phone-only, invalid, or no
contacts; interval changes; profile deletion and the 3-month purge; 24-hour location cleanup with
retention of emergency locations; link expiry; notification success and failure; and repeated
worker runs.

## Layout

| Module | Responsibility |
|---|---|
| `deadman/db.py` | Schema migrations (`PRAGMA user_version`), connections, transactions |
| `deadman/accounts.py` | Passwordless device-bound auth: register, login, refresh rotation, logout |
| `deadman/checkins.py`, `switch.py` | Check-ins and deadline rules |
| `deadman/engine.py` | Finds expired switches, triggers events, queues notifications |
| `deadman/notifications/` | Message copy, Resend and Twilio providers, delivery dispatcher |
| `deadman/retention.py` | Location, link, session, and archived-profile cleanup |
| `deadman/web/emergency_page.py` | Public emergency page (Mapbox GL JS) |
| `deadman/api/` | HTTP routes, schemas, dependencies |
| `deadman/worker.py` | Worker entry point |

## Endpoints

All `/api/v1` routes except `auth/register`, `auth/login` and `auth/refresh` require
`Authorization: Bearer <access token>`. Errors use `{"error": {"code", "message", "field"}}`.

| Method and path | Purpose |
|---|---|
| `POST /api/v1/auth/register` | Create an account; returns `user_id`, `account_key` and tokens |
| `POST /api/v1/auth/login` | Sign in again with `user_id` and `account_key` |
| `POST /api/v1/auth/refresh` | Rotate the refresh token and get a new access token |
| `POST /api/v1/auth/logout` | Revoke the current session |
| `GET/PATCH/DELETE /api/v1/me` | Profile; `DELETE` archives the account |
| `POST /api/v1/check-ins` | Record a check-in (idempotent by `client_id`) |
| `GET /api/v1/check-ins/latest`, `/check-ins/status` | Latest check-in, or check-in plus switch status |
| `GET/POST /api/v1/contacts`, `GET/PUT/DELETE /api/v1/contacts/{id}` | Emergency contacts |
| `POST /api/v1/locations`, `GET /api/v1/locations/last` | Upload location points (these never count as a check-in); last known location |
| `GET /api/v1/switch/status`, `/switch/deadline`, `/switch/events/latest` | Authoritative switch state |
| `GET /e/{token}` | Emergency page for contacts (HTML) |
| `GET /api/v1/emergency/{token}` | Emergency page data (JSON) |
| `POST /webhooks/twilio/status` | Twilio delivery status callback (signature verified) |
| `GET /health` | Liveness |

## Design decisions

These choices resolve points the specification left open.

- **Server time decides deadlines.** A check-in's deadline is computed from when the server
  received it, not from the phone's clock. A check-in exactly at the deadline is on time
  (the switch expires only when `deadline < now`).
- **A late check-in that arrives before the worker runs prevents the trigger.** The trigger is a
  conditional update from `armed` to `triggered`, so a check-in and a worker racing each other
  can't both win.
- **No duplicate alerts.** Events are unique per `(user, deadline)`, and notifications are unique
  per `(event, contact, channel)`. A notification is claimed before sending. If the process dies
  mid-send, the row stays in `sending` and is not retried automatically, because a stuck row is
  better than alerting someone twice.
- **Failures are never recorded as success.** A provider error, a missing configuration
  (`channel_not_configured`), or a failed Twilio status callback leaves the notification `failed`
  with a reason.
- **Channels.** Contacts with an email get an email via Resend. Contacts with a phone get
  WhatsApp if flagged, otherwise SMS, both via Twilio. WhatsApp requires an approved template
  (`TWILIO_WHATSAPP_CONTENT_SID`).
- **Emergency links.** There is one unguessable link per notification, and only its SHA-256 hash
  is stored. Links expire after 30 days and never expose internal IDs.
- **Locations.** Journey points are deleted after 24 hours unless they are tied to an emergency
  event whose link is still valid. The single "last known location" row is kept while the
  account is active, so a trigger after a long interval still has somewhere to point to.
- **Shortening the interval** so that the deadline would already have passed is rejected with
  `409 interval_would_expire`. Otherwise changing the interval would trigger the switch instantly.
- **Account deletion** archives the profile, stops the switch, deletes locations immediately,
  and hard-deletes everything after 90 days.
- **Out of scope for now:** rate limiting, and an "all clear" message to contacts after the user
  checks in following a trigger. The app does show the user that the alert was resolved.
- **PostgreSQL-ready schema.** It uses TEXT UUIDs, UTC ISO-8601 timestamps, foreign keys with
  `ON DELETE CASCADE`, and indexes on every worker query. Production must be served over HTTPS.
