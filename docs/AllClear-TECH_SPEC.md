# AllClear — Technical Specification

**Version:** 1.0
**Date:** September 11, 2026

---

## 1. Architecture Overview

### 1.1 System Diagram (described in text)
- **Frontend + synchronous API:** A single Next.js app (App Router) deployed on Vercel serves the marketing site, the authenticated dashboard, and REST-style API routes for anything a user-facing request needs synchronously (managing Watch Locations, layer toggles, notification rules, reading cached hazard data).
- **Background ingestion worker:** A separate Node worker, deployed on Railway as a scheduled/long-running process, polls each external hazard API on its own cadence and writes normalized results into Postgres. It also evaluates notification rules against newly ingested events and triggers web push / email sends.
- **Database:** Supabase Postgres, with the PostGIS extension enabled for proximity ("hazards within N miles of this point") queries. Supabase Auth handles user accounts. Row Level Security restricts each user's Watch Locations, layer settings, and notification rules to that user.
- **Maps:** Leaflet.js rendering OpenStreetMap tiles (free, no API key), with GeoJSON hazard layers served from our own `/api/hazards/*` endpoints — the client never calls FIRMS, AirNow, USGS, or NWS directly.
- **Notifications:** Web Push (service worker + VAPID keys) as the primary channel for MVP; email via Resend as a secondary/fallback channel.
- **External integrations:** NWS/NOAA API, NASA FIRMS, USGS Earthquake API, AirNow API, and InciWeb/NIFC (see §5 for access details and open questions on the last two).

> ⚠️ Assumption: this spec assumes a single Next.js monorepo with a `apps/web` package and a separate `apps/worker` package, sharing a `packages/shared` for types and the Supabase client. If the team prefers fully separate repos, the architecture is unaffected — only the folder structure in CLAUDE.md changes.

### 1.2 Tech Stack Decision Table
| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14+ (React, App Router) | Single framework for marketing site + authenticated app; tightly integrated with Vercel, which is already connected |
| Backend / API | Next.js API routes (sync) + Node worker on Railway (async) | Avoids a second framework for MVP; separates fast user-facing reads from slow/rate-limited external polling |
| Database | Supabase Postgres (+ PostGIS) | Already connected; PostGIS gives cheap, correct proximity queries instead of hand-rolled distance math |
| Auth | Supabase Auth | Already connected; avoids building session/password management from scratch |
| File storage | Not used in MVP | No user-uploaded content (photos, etc.) in MVP scope |
| Hosting (FE) | Vercel | Already connected; native fit for Next.js |
| Hosting (BE / worker) | Railway | Already connected; well-suited to scheduled/long-running jobs, unlike Vercel's serverless execution limits |
| CI/CD | GitHub Actions → Vercel + Railway auto-deploy on push to `main` | Standard, low-maintenance |
| Monitoring | Sentry (errors) + Vercel Analytics / Railway metrics (uptime, load) | |
| Email / notifications | Resend (email) + Web Push API (browser push) | Resend is a modern, low-friction transactional email provider; Web Push needs no third-party vendor for MVP |

### 1.3 Key Architectural Decisions

**Normalize-and-cache instead of direct client-to-government-API calls.**
Rejected letting the browser call FIRMS/AirNow/USGS/NWS directly. Reasons: (a) FIRMS and AirNow require secret API keys that can't be shipped to a client bundle; (b) all four sources have rate limits that many concurrent users would blow through trivially; (c) a shared cache table makes every user's dashboard load fast (one DB read) instead of waiting on up to five external round-trips.

**Next.js monolith over separate frontend/backend services for the synchronous path.**
Rejected a standalone Express/Fastify backend as unnecessary complexity for MVP — there's no heavy compute on the request path, just CRUD and cache reads. The one genuinely different workload (scheduled external polling) is pulled out into its own worker instead.

**Railway worker over Vercel Cron Functions for polling.**
Rejected serverless cron functions because polling multiple external APIs with retry/backoff logic runs more reliably as a persistent scheduled process than as a function with an execution time limit. Railway is already connected and built for exactly this.

**Web Push over native push for MVP.**
Native push (APNs/FCM) isn't available until there's a native app. Web Push is the closest MVP-compatible equivalent, and the underlying pattern (register a device/subscription, target a send) carries forward conceptually into the Phase 2 native app.

---

## 2. Data Model

### 2.1 watch_locations
```
Table: watch_locations
- id: uuid, PK
- user_id: uuid, FK → auth.users(id)
- label: text — e.g. "Home", "Mom's house"
- latitude: numeric
- longitude: numeric
- city_name: text, nullable
- state: text, nullable
- country: text, default 'US'
- is_primary: boolean, default false
- created_at: timestamp
- updated_at: timestamp
```
Relationships: belongs_to user; has_many location_layers; has_many notification_rules

Indexes: `(user_id)`; GiST spatial index on `(latitude, longitude)` via PostGIS for proximity queries

### 2.2 location_layers
```
Table: location_layers
- id: uuid, PK
- watch_location_id: uuid, FK → watch_locations(id)
- layer_type: enum('weather','wildfire','earthquake','air_quality') — official_alerts is always-on, not stored here
- enabled: boolean, default true
- radius_miles: numeric, default 25 — proximity radius for wildfire/earthquake layers
- created_at: timestamp
```
Relationships: belongs_to watch_location

### 2.3 notification_rules
```
Table: notification_rules
- id: uuid, PK
- watch_location_id: uuid, FK → watch_locations(id)
- layer_type: enum('weather','wildfire','earthquake','air_quality','official_alerts')
- condition_type: enum('distance_threshold_miles','magnitude_threshold','aqi_threshold','any_active')
- threshold_value: numeric, nullable
- channel: enum('web_push','email','both'), default 'both'
- enabled: boolean, default true
- created_at: timestamp
```
Relationships: belongs_to watch_location

### 2.4 cached_hazard_events
```
Table: cached_hazard_events
- id: uuid, PK
- source: enum('nws','firms','inciweb','usgs','airnow')
- external_id: text — the source's own ID for this event, for de-duplication
- event_type: text — e.g. 'severe_alert', 'fire_hotspot', 'fire_incident', 'earthquake', 'aqi_reading'
- title: text
- description: text, nullable
- severity: text, nullable
- latitude: numeric, nullable
- longitude: numeric, nullable
- geometry: geography, nullable — for polygons (e.g. fire perimeters, alert zones)
- raw_payload: jsonb — full original response, for debugging and future re-parsing
- fetched_at: timestamp
- expires_at: timestamp, nullable — when this row should be considered stale
```
Relationships: none (not user-owned; shared across all users, queried by proximity to each user's watch_locations at read time)

Indexes: `(source, external_id)` unique; `(source, fetched_at)`; GiST spatial index on `(latitude, longitude)` and on `geometry`

### 2.5 notifications_log
```
Table: notifications_log
- id: uuid, PK
- user_id: uuid, FK → auth.users(id)
- watch_location_id: uuid, FK → watch_locations(id)
- notification_rule_id: uuid, FK → notification_rules(id), nullable
- hazard_event_id: uuid, FK → cached_hazard_events(id), nullable
- summary: text — the human-readable message that was sent
- channel: enum('web_push','email')
- sent_at: timestamp
```
Relationships: belongs_to user; belongs_to watch_location

---

## 3. Authentication & Authorization

- Auth provider: Supabase Auth (email/password for MVP; Google/Apple OAuth as a fast-follow, not MVP)
- Session strategy: Supabase's cookie-based session, refreshed via Supabase's client SDK
- Roles: single `user` role for MVP — no admin panel or staff roles in scope
- Protected routes: everything under `/dashboard/*` and all `/api/locations/*`, `/api/notification-rules/*` routes require a valid session. `/api/hazards/map` (the national public map data) and the marketing pages are intentionally unauthenticated.
- Authorization model: Row Level Security policies on `watch_locations`, `location_layers`, `notification_rules`, and `notifications_log` restrict every row to `auth.uid() = user_id` (directly or via the `watch_location_id` join). `cached_hazard_events` has no RLS — it's public, read-only shared reference data.

---

## 4. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (client-side) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server/worker only, never exposed to client) | ✅ |
| `DATABASE_URL` | Direct Postgres connection string, for the worker and migrations | ✅ |
| `NASA_FIRMS_MAP_KEY` | Free registration key for the FIRMS API | ✅ |
| `AIRNOW_API_KEY` | Free registration key for the AirNow API | ✅ |
| `NWS_USER_AGENT` | Descriptive User-Agent string NWS requires on every request (app name + contact email) | ✅ |
| `RESEND_API_KEY` | Transactional email provider key | ✅ |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push signing keypair | ✅ |
| `SENTRY_DSN` | Error tracking | ✅ |

---

## 5. Third-Party Integrations

**NWS / NOAA API** (`api.weather.gov`)
- What it does: forecasts, hourly conditions, and active CAP-formatted alerts (severe weather + many relayed non-weather alerts)
- Auth: none required, but every request must send a descriptive `User-Agent` header identifying the app and a contact method, or requests may be throttled
- Rate limits: not publicly documented, described as "generous" for typical use; the worker should still cache and poll on an interval (e.g., every 10-15 min per watched location cluster) rather than per-request
- Fallback: if unreachable, serve the last cached forecast/alerts with a visible "last updated" timestamp rather than blocking the page

**NASA FIRMS** (`firms.modaps.eosdis.nasa.gov/api`)
- What it does: near-real-time satellite fire/hotspot detections (MODIS, VIIRS, Landsat)
- Auth: free `MAP_KEY` registration required
- Rate limits: 5,000 transactions per 10-minute window per key — the worker polls by bounding box across all active watch-location clusters, not per-user
- Fallback: on failure, keep the last known hotspot set and flag it as stale after a defined TTL

**InciWeb / NIFC**
- What it does: official, human-curated wildfire incident data (named fires, containment %, acreage, evacuation status)
- Auth / access: **no confirmed clean public JSON API.**
- > ⚠️ Assumption: implement against NIFC's public open-data/ArcGIS feeds (e.g., WFIGS-style incident and perimeter layers) as the primary structured source, with InciWeb's RSS feed as a fallback for narrative text updates. Verify the exact current endpoint during Step 5 of the build (see CLAUDE.md) before committing to a parsing approach.
- Fallback: if no structured feed is reachable, this layer can degrade to "FIRMS hotspots only, no official incident metadata" without breaking the product.

**USGS Earthquake API** (`earthquake.usgs.gov`)
- What it does: real-time GeoJSON feeds of earthquake events, filterable by time window, magnitude, and location
- Auth: none required
- Rate limits: none documented; still poll on an interval (e.g., every 1-2 min) rather than on every user request
- Fallback: low risk — this is the most stable/simple integration in the stack

**AirNow API** (`docs.airnowapi.org`)
- What it does: current and forecast Air Quality Index by location
- Auth: free API key registration required
- Rate limits: daily quota tied to the free key tier — batch requests by rounded lat/lng grid cells rather than per-exact-coordinate to conserve quota
- Fallback: serve last cached AQI reading with a staleness indicator

**IPAWS**
- > ⚠️ Assumption: IPAWS itself is built for certified government "alerting authorities" to *originate* alerts across EAS/WEA/NOAA Weather Radio — it is not a general-purpose public API for third parties to *subscribe* to. For MVP, the "Official Alerts" module is implemented entirely on top of the NWS active-alerts endpoint above, which already surfaces CAP-formatted alerts. Revisit this if a broader all-hazards feed (e.g., Amber Alerts) becomes necessary.

**Resend** (email) and **Web Push** (browser push)
- Standard transactional integrations; no rate-limit concerns at MVP scale; fallback is simply "notification not delivered on that channel," logged for retry.

---

## 6. Performance & Scalability Considerations

- Expected load at launch: low (early users) — but the cache-first architecture is designed so growth doesn't require rework, only tuning poll frequency and cache TTLs.
- Main bottleneck risk: FIRMS and AirNow rate/quota limits if the user base grows quickly. Mitigated structurally by the shared-cache pattern — poll frequency scales with *geographic coverage area*, not user count.
- Caching strategy: `cached_hazard_events` is the single source of truth for all hazard data served to users; nothing reads external APIs directly on a user request.
- DB query optimizations: PostGIS spatial indexes on both `watch_locations` and `cached_hazard_events` for "what's within N miles" queries; composite index on `(source, fetched_at)` for the worker's own upsert/staleness logic.

---

## 7. Security Considerations

- Input validation: all API route inputs validated with a schema library (e.g., Zod) server-side, never trusting client-supplied lat/lng or thresholds without bounds-checking
- Injection/XSS prevention: parameterized queries via Supabase client (no raw string SQL); React's default escaping for all rendered content
- Rate limiting: the unauthenticated `/api/hazards/map` endpoint needs IP-based rate limiting (it's the one publicly exposed surface); authenticated endpoints rate-limited per-user as a secondary defense
- Sensitive data handling: external API keys (FIRMS, AirNow, Resend, VAPID private key, Supabase service role key) are server/worker-only environment variables, never included in the client bundle
- HTTPS: enforced by default on Vercel and Railway
- CORS: API routes accept same-origin requests only for MVP — no public third-party API consumers yet

---

## 8. Testing Strategy

| Layer | Approach | Tools |
|---|---|---|
| Unit tests | Distance/proximity math, threshold-rule evaluation logic, poller response normalization | Vitest |
| Integration tests | API routes against a test Supabase project | Vitest + Supabase test instance |
| E2E tests | Sign up → add a Watch Location → dashboard populates with real cached data | Playwright |
| Manual QA | Cross-browser + mobile web responsive check before each release | Manual checklist (see Launch Checklist) |

---

## 9. Deployment Plan

- Environments: local → Vercel preview deployment per pull request → production on merge to `main`. Railway worker mirrors this with its own staging/production environments.
- Deployment process: GitHub Actions runs tests → Supabase CLI applies pending migrations → Vercel builds/deploys the web app → Railway redeploys the worker image.
- Rollback plan: Vercel's instant rollback to the previous deployment for the web app; Railway redeploy of the previous worker image. Database migrations are written to be additive/backward-compatible wherever possible so a code rollback doesn't require a matching DB rollback.
- DB migration strategy: migration files checked into `supabase/migrations`, applied via Supabase CLI in CI before the app deploy step — never run manually against production.
