# AllClear

One calm dashboard for the places you care about: weather, wildfire & smoke, earthquakes, air quality and official alerts — every fact sourced from a named public feed (NWS, NASA FIRMS, USGS, AirNow, NIFC/InciWeb, NOAA NHC, EPA).

The product docs that drive this build live in [`docs/`](docs/): [PRD](docs/AllClear-PRD.md) · [Tech Spec](docs/AllClear-TECH_SPEC.md) · [API Design](docs/AllClear-API_DESIGN.md) · [UI/UX Notes](docs/AllClear-UI_UX_NOTES.md) · [Launch Checklist](docs/AllClear-LAUNCH_CHECKLIST.md). The build prompt is [`CLAUDE.md`](CLAUDE.md).

## Layout

```
apps/web        Next.js 16 (App Router) — marketing site, authenticated dashboard, REST API routes  → Vercel
apps/worker     Node worker — polls NWS / FIRMS / USGS / AirNow / NIFC / NHC / EPA, evaluates rules, sends push + email → Railway
packages/shared Types, Zod schemas, geo math, AQI categories, rule evaluation, Supabase Database type
supabase/       migrations (PostGIS schema, RLS, RPCs), dev seed, CLI config
```

## Quick start

```bash
pnpm install
cp .env.example .env            # fill in Supabase + API keys (see below)

# Database: apply the migration to a Supabase project (or a local `supabase start`)
supabase link --project-ref <ref> && supabase db push
# optional dev-only sample hazards so the dashboard has something to show:
supabase db execute -f supabase/seed.sql      # never against production

pnpm dev            # web app on http://localhost:3000
pnpm dev:worker     # ingestion worker + /health on http://localhost:8080
```

### Environment

Everything is listed in [`.env.example`](.env.example). The web app needs the `NEXT_PUBLIC_*` values plus `SUPABASE_SERVICE_ROLE_KEY` (account deletion, ownership checks) and `NWS_USER_AGENT` (used for geocoding requests). The worker needs the Supabase service role, the free [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/) and [AirNow](https://docs.airnowapi.org/account/request/) keys, `NWS_USER_AGENT`, a [Resend](https://resend.com) key for email, and a VAPID keypair for Web Push:

```bash
pnpm --filter @allclear/worker vapid   # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

A poller whose key is missing is skipped with a warning; the rest of the product keeps working (Tech Spec §5 fallbacks).

## Scripts

| Command | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` for every package |
| `pnpm lint` | ESLint (web) |
| `pnpm test` | Vitest unit tests (shared: geo/rules/schemas; web: rate limiter; worker: normalizers + notification selection) |
| `pnpm build` | `next build` for the web app; type-checks the worker |
| `pnpm --filter @allclear/worker poll usgs` | Run one poller once (`usgs`, `firms`, `nws_alerts`, `nws_weather`, `airnow`, `nifc`) |

## Free data sources

Everything AllClear shows comes from a public feed that needs no paid plan. Only NASA FIRMS and AirNow need a (free) API key; the rest are open.

| What | Feed | Cadence |
| --- | --- | --- |
| Official alerts, forecasts, observations | NWS `api.weather.gov` | 5–15 min |
| Satellite fire hotspots | NASA FIRMS (key) | 15 min |
| Named incidents | NIFC WFIGS incident locations (InciWeb RSS fallback) | 15 min |
| Active fire perimeters | NIFC WFIGS interagency perimeters | 20 min |
| 10-year fire history near each Watch Location | NIFC interagency perimeter history | daily |
| Earthquakes | USGS GeoJSON feed | 5 min |
| Air quality | AirNow (key) | 30 min |
| UV index | EPA Envirofacts UV daily forecast (by ZIP) | 6 h |
| Tropical cyclones | NOAA NHC `CurrentStorms.json` | 30 min |
| Basemaps | OpenStreetMap, USGS National Map imagery + topo tiles | — |
| Radar overlay | Iowa Environmental Mesonet NEXRAD composite tiles | live |
| Sea-surface temperature overlay | NOAA CoastWatch ERDDAP (JPL MUR) WMS | daily |
| Live wildfire cameras | Link out to ALERTWildfire (no API) | — |

Not included because no free feed exists: utility power-outage maps, embedded camera video, and Windy-style wind animation.

## Architecture in one paragraph

The browser never calls a government API. The worker polls each source on its own cadence, normalizes results into `cached_hazard_events` (and `cached_weather`), and every user-facing read — dashboard cards, location detail, the public national map — is a PostGIS proximity query over that shared cache (`hazards_near`, `alerts_for_point`, `hazards_in_bbox`, `nearest_weather`, `dashboard_summary`). Polling cost therefore scales with geographic coverage, not user count: the worker groups Watch Locations into grid cells before hitting NWS/AirNow. After every successful poll the worker evaluates enabled notification rules against the fresh cache, de-duplicates against `notifications_log`, rolls up hotspot bursts, applies cooldowns, and delivers via Web Push (with email as fallback).

## Deploying

- **Web → Vercel** (Tech Spec default): root directory `apps/web`, framework Next.js, install command `pnpm install --frozen-lockfile` from the repo root (enable "Include files outside root directory"). Set the env vars above. The web app also runs on Railway via `apps/web/Dockerfile`, which is how the first draft is hosted (service settings: Dockerfile path `apps/web/Dockerfile`, healthcheck `/privacy`, domain target port 3000).
- **Worker → Railway.** `apps/worker/Dockerfile` (service settings: Dockerfile path `apps/worker/Dockerfile`, healthcheck `/healthz`, port 8080). Liveness `/healthz`, readiness `/health` (503 until every enabled poller has succeeded recently, or until `SUPABASE_SERVICE_ROLE_KEY` is set). Set the same Supabase vars plus the API keys.
- Railway's config-as-code (`railway.json`) is deprecated on their platform, so service settings are configured on the services themselves.
- **Database → Supabase.** CI applies `supabase/migrations` with the Supabase CLI before deploying. Migrations are additive so a code rollback never needs a DB rollback (Tech Spec §9).

See [`docs/AllClear-LAUNCH_CHECKLIST.md`](docs/AllClear-LAUNCH_CHECKLIST.md) before announcing anything.

## Where the spec was interpreted

- `location_layers.min_magnitude` was added (PRD §3.4 asks for a per-location magnitude floor that the API Design's layer object didn't carry). It is exposed as an optional field on the layers endpoints.
- `cached_hazard_events` gained explicit `magnitude`, `aqi`, `occurred_at` and `attributes` columns so proximity queries can filter without unpacking `raw_payload`.
- Tables `push_subscriptions` (Web Push endpoints) and `poller_runs` (worker heartbeat for the monitoring items in the Launch Checklist) were added.
- IPAWS is not consumed; "Official Alerts" is the NWS active-alerts feed, exactly as the Tech Spec §5 assumption says. A `weather` notification rule means "Severe/Extreme NWS alerts only"; `official_alerts` means any active alert.
- Rate limiting is in-memory per instance (API Design §9 limits are enforced; swap the store for Redis if abuse appears).
- Location search uses OpenStreetMap Nominatim, proxied server-side with the required User-Agent and 1 req/s throttle.
