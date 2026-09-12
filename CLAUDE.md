# CLAUDE.md — AllClear

This is the build prompt / working agreement for AllClear. Read the five documents in `docs/` before changing anything substantive: the PRD (what and why), Tech Spec (architecture, data model, integrations), API Design (every endpoint and the error format), UI/UX Notes (every screen, every state) and Launch Checklist (what "done" means).

## What this app does

A user builds a Watch List of places (home, a parent's city, a trip) and, per place, picks which hazard layers matter: weather, wildfire & smoke, earthquakes, air quality. Official NWS alerts are always on. Every card names its data source. Users set their own notification thresholds (fires within N miles, quakes above M, AQI above X) and get Web Push and/or email. There is a public, no-login national map of fires and quakes.

Non-goals for MVP: scanner audio, AI risk summaries, native apps, non-US weather, social features, billing.

## Stack and layout

- `apps/web` — Next.js 16 App Router on Vercel. Marketing pages, authenticated app, and the REST API under `/api`. Supabase Auth via `@supabase/ssr` (cookies). Tailwind v4 with the design tokens in `src/app/globals.css`. Leaflet + OpenStreetMap tiles (no key).
- `apps/worker` — Node (tsx) on Railway. Pollers in `src/pollers/*` write normalized rows to `cached_hazard_events` / `cached_weather`; `src/notify/*` evaluates rules and sends push/email; `/health` for uptime checks.
- `packages/shared` — types, Zod schemas, geo math, AQI categories, rule matching, the Supabase `Database` type. Consumed as TypeScript source.
- `supabase/migrations` — the schema. PostGIS is in the `extensions` schema. All read-side proximity logic lives in SQL functions (`hazards_near`, `alerts_for_point`, `hazards_in_bbox`, `nearest_weather`, `dashboard_summary`, `perimeters_near`, `hazard_polygons_in_bbox`).

## Rules that must hold

1. **Never call an external hazard API from a user request.** Reads come from the caches only. Only the worker talks to NWS/FIRMS/USGS/AirNow/NIFC/NHC/EPA. Map tiles and overlays (OSM, USGS, NEXRAD, ERDDAP) are the one exception: the browser loads them directly because they are public, key-less image tiles.
2. **Every API response uses the error envelope in API Design §8** — go through `withErrorHandling` and throw `ApiError`.
3. **Validate every input server-side with the Zod schemas in `packages/shared`** (lat/lng bounds, threshold ranges, layer/condition combinations).
4. **RLS is the authorization model.** User-owned tables are scoped by `auth.uid()`; the caches are public read-only; only the service role writes caches. Don't bypass RLS in web routes except through `getAdminClient()` for the two documented cases (account deletion, 403-vs-404 ownership check).
5. **Never a blank gap.** Every section has empty, loading and error states (UI/UX Notes §3). Errors are human-readable; never show a raw API error.
6. **Severity is never colour alone** — always paired with text. Red is reserved for warnings/danger, amber for advisories; teal is the brand.
7. **Secrets stay server-side.** `NASA_FIRMS_MAP_KEY`, `AIRNOW_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY` never reach the client bundle. Only `NEXT_PUBLIC_*` values may.
8. **Push permission is asked after the user creates a rule**, never on signup.
9. **Polling scales with coverage, not users.** Per-point sources (NWS, AirNow) are polled per grid cell (`cellsFor`), never per user.
10. **Don't spam.** Rule evaluation de-duplicates per event via `notifications_log`, rolls hotspot bursts into one message, and applies cooldowns (`src/notify/select.ts`). Keep it that way when adding sources.

## Build order (the steps the original build followed)

1. Monorepo scaffold, shared package, migrations (verified against a real PostGIS instance).
2. Web API routes exactly as API Design §3–7, plus `/api/geocode`, `/api/push/subscribe`, `/api/account`.
3. Web UI: marketing → auth → onboarding wizard → dashboard → location detail (streaming sections) → public map → alerts history → settings.
4. Worker: pollers (USGS, NWS alerts, NWS weather, FIRMS, NIFC with InciWeb RSS fallback, NIFC perimeters + 10-year history, NHC storms, AirNow, EPA UV) → scheduler + heartbeat → rule evaluation → push + email.
5. Verify: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Verifying changes

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @allclear/web build
```

For schema changes, add a new file under `supabase/migrations` (never edit an applied one), keep it additive, update `packages/shared/src/database.types.ts`, and re-run the SQL smoke test described in the PR that introduced the schema (harness: `auth.users` stub + `anon`/`authenticated`/`service_role` roles, then the migration, seed, and RPC calls as two different users).
