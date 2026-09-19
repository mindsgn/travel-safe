# Backend Architecture

The backend runs on Python 3.12 with FastAPI and Uvicorn. It is the single
public API consumed by the Travel Safe Expo client.

## API contract

| Endpoint | Method | Access | Response |
|---|---|---|---|
| `/health` | GET | None | `{ "status": "ok" }` |
| `/api/v1/sources` | GET | None | Source list with governance status, role and URL |
| `/api/v1/stats` | GET | `area_code` | Precinct-level reported-crime statistics + caveats |
| `/api/v1/heatmap` | GET | `bbox=west,south,east,north&zoom=5..18` | Aggregate map cells; never fabricated incident pins |
| `/api/v1/areas/{area_code}/safety` | GET | Path area code | Confidence-aware signal; may return `insufficient_data` |
| `/api/v1/trips` | POST | `{ origin, destination, profile? }` — each point is `{ latitude, longitude, label? }`; `profile` is `walking` (default) or `driving` | Pathway polyline (`coordinates` as `[lng, lat]`), plus a corridor heatmap of mock crime-intensity cells in a padded origin–destination bbox. `pathway.provider` is `mapbox` when `MAPBOX_ACCESS_TOKEN` succeeds, otherwise `mock`. `422` if coordinates are invalid or origin and destination are the same place. |
| `/health` | GET | Public | `{"status":"ok"}` |
| `/api/v1/sources` | GET | Public | Safety-source governance |
| `/api/v1/dataset/status` | GET | Public | Active national safety-data mode |
| `/api/v1/stats` | GET | Public | Station annual statistics |
| `/api/v1/heatmap` | GET | Public | National station safety anchors |
| `/api/v1/map/search` | GET | Public | Police-station safety search |
| `/api/v1/search` | GET | Public | Unified Halo + internal safety search |
| `/api/v1/routes/analyse` | POST | Public | Lower-risk context for supplied real route alternatives |
| `/api/v1/areas/{area_code}/safety` | GET | Public | Safety + danger signal |
| `/api/v1/emergency-numbers` | GET | Public | Verified emergency picker numbers |
| `/api/v1/location-groups` | POST | Public create | Demo group code + secret key |
| `/api/v1/location-groups/{group_code}/join` | POST | `X-Group-Key` | Join temporary member |
| `/api/v1/location-groups/{group_code}/members/{client_id}/location` | PUT | `X-Group-Key` | Publish latest member location |
| `/api/v1/location-groups/{group_code}/locations` | GET | `X-Group-Key` | Poll latest member locations |
| `/api/v1/halo` | GET | Public | Halo list + visitability aggregates |
| `/api/v1/halo` | POST | `X-Client-ID` | Create community Halo |
| `/api/v1/halo/{halo_id}` | GET | Public | Halo detail + aggregates |
| `/api/v1/halo/{halo_id}/rating` | PUT | `X-Client-ID` | Idempotent rating/like/visit signal |
| `/api/v1/halo/{halo_id}/rating-settings` | PUT | Submitter `X-Client-ID` | Demo rating enable/disable |

## Access model

The hackathon backend intentionally separates three access modes:

- Period: Apr 2025–Mar 2026.
- Total reported crimes: 3,541.
- Latest quarter Apr–Jun 2026: 910 vs 800 in Apr–Jun 2025.
- Data resolution remains whole police precinct.
- The fixture is not a live SafeSuburb feed and must not be represented as one.
- Heat-map centroids are area context only, not crime-event coordinates.
- `POST /api/v1/trips` adds a padded corridor heatmap of mock crime-intensity cells (plus the Woodstock fixture when it falls in the box). Those cells are not live incident pins.
- The API intentionally withholds a safety score until peer calibration, denominator quality and model validation are agreed.
1. **Public reads** for safety data, Halo discovery, and emergency numbers.
2. **Temporary client identity** via `X-Client-ID` for Halo community writes.
3. **Secret-scoped group access** via `X-Group-Key` for trusted-location groups.

Neither temporary header is production authentication. Firebase/token
verification remains deferred.

## National safety data

The backend prefers a fully validated DataFirst/SAPS v1.4 CSV. If one is not
configured, it uses the checked-in validated 2025/2026 derived snapshot.

Validated v1.4 signature:

- 24,206 total station-year records;
- 1,174 stations in 2025/2026;
- 1,128 mappable station rows in the demo snapshot;
- model `danger-v1.1`.

Risk bands:

- Green: danger < 45;
- Orange: 45 <= danger < 75;
- Red: danger >= 75.

## Halo and safety remain separate

Halo is a community visitability layer. Halo ratings, likes, and visit
evidence never modify `danger_score`, `safety_score`, or risk bands.

A Halo may be highly rated while its surrounding area remains red/high-danger.

## Trusted-location groups

Trusted-location groups are demo-only:

- the short group code is human-facing;
- `X-Group-Key` is required for join/read/write;
- only latest locations are retained in process memory;
- restart clears group/location state;
- stale positions are timestamp-driven.

See:

- [api-auth.md](api-auth.md)
- [danger-scoring.md](danger-scoring.md)
- [safety-data-sources.md](safety-data-sources.md)
- [emergency-numbers.md](emergency-numbers.md)
- [trusted-location-groups.md](trusted-location-groups.md)
- [halo.md](halo.md)
- [frontend-backend-integration.md](frontend-backend-integration.md)
- [search-routing.md](search-routing.md)
