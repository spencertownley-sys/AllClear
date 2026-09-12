# AllClear — Launch Checklist

---

## Pre-Launch: Engineering

### Code Quality
- [ ] No hardcoded secrets, API keys, or credentials in code (check especially: `NASA_FIRMS_MAP_KEY`, `AIRNOW_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`)
- [ ] `.env.example` up to date with every variable from Tech Spec §4
- [ ] All console.log / debug statements removed from production paths (both `apps/web` and `apps/worker`)
- [ ] Error boundaries / fallback UI in place for critical screens (Dashboard, Location Detail)
- [ ] All major user flows tested end-to-end manually

### Security
- [ ] All API endpoints properly authenticated except the two intentionally public ones (`GET /api/hazards/map`, marketing pages)
- [ ] Input validated and sanitized server-side on every API route (lat/lng bounds, threshold ranges, enum values)
- [ ] HTTPS enforced (Vercel/Railway default — confirm no mixed content)
- [ ] CORS policy restricts API routes to same-origin
- [ ] Rate limiting enabled on `/api/hazards/map` specifically, given it's the one unauthenticated surface
- [ ] Row Level Security verified on `watch_locations`, `location_layers`, `notification_rules`, `notifications_log` — confirm one user genuinely cannot read another's data
- [ ] No sensitive data exposed in API responses or client-side code (double-check `apps/web` build output doesn't bundle server-only env vars)

### Performance
- [ ] Map tiles and hazard overlays load progressively, don't block initial page render
- [ ] No N+1 query problems on the Dashboard (fetching all Watch Locations' hazard summaries should be a small, bounded number of queries, not one per card per layer)
- [ ] Page load time < 3s on simulated 3G (Lighthouse check) for Dashboard and Marketing pages
- [ ] Bundle size reasonable (`npm run build` output checked)

### Database
- [ ] All migrations run in production, including PostGIS extension enablement
- [ ] Spatial indexes in place on `watch_locations` and `cached_hazard_events`
- [ ] DB connection pooling configured (Supabase's pooler, both for the web app and the worker)
- [ ] Backups enabled and a restore tested at least once before launch

### Monitoring & Observability
- [ ] Sentry configured for both `apps/web` and `apps/worker` — a silent worker failure is worse than a silent frontend bug here, since it means hazard data quietly goes stale
- [ ] Uptime monitoring configured for the web app and for the worker's scheduler (e.g., a heartbeat check that alerts if no poller has run successfully in N minutes)
- [ ] Logging in place for: sign ups, notification rule creation, every poller run (success/failure/row count), every notification sent
- [ ] Alerts configured for: error spikes, a poller failing repeatedly, `cached_hazard_events` going stale for any source beyond its expected TTL

---

## Pre-Launch: Product

### UX
- [ ] All screens have the empty states described in UI/UX Notes §3 (never a blank gap)
- [ ] All async actions show loading indicators
- [ ] Error messages are human-readable — no raw API errors or stack traces shown to users
- [ ] Responsive: tested on mobile, tablet, and desktop, per the mobile-first navigation pattern in UI/UX Notes §4
- [ ] Favicon, page title, and meta description set
- [ ] 404 page exists

### Onboarding
- [ ] New user onboarding flow (add first location → pick layers) tested with a genuinely fresh account
- [ ] First value moment (a populated Dashboard card) reachable within 2 minutes of signup
- [ ] Web Push permission prompt timing tested — ask after the user has set at least one notification rule, not immediately on signup, to avoid a reflexive "deny"

### Legal & Compliance
- [ ] Privacy Policy published and linked in footer — explicitly state what location data is stored and that it's never sold, mirroring the trust positioning used in the original concept doc
- [ ] Terms of Service published and linked
- [ ] Given the safety-adjacent nature of the product, confirm whether a plain-language disclaimer is needed stating AllClear relays public data and is not an official emergency notification system (this is the open legal question flagged in the PRD)
- [ ] GDPR/CCPA considerations addressed if any non-US users are expected, even though weather coverage is US-only for MVP
- [ ] Accessibility: keyboard nav works, contrast passes AA (see UI/UX Notes §6)

---

## Pre-Launch: Infrastructure

- [ ] Custom domain configured and DNS propagated
- [ ] SSL certificate active
- [ ] Production environment variables set in both Vercel and Railway — confirm these are production keys (e.g., a production AirNow/FIRMS key, not a personal dev key with a tiny quota)
- [ ] Deployment pipeline verified: push to `main` → Vercel deploys web, Railway redeploys worker
- [ ] Rollback plan documented and, ideally, rehearsed once before launch (see Tech Spec §9)
- [ ] Confirm the worker's scheduler is actually running in the Railway production environment and `cached_hazard_events` is populating before announcing launch — this is the one component with no user-facing surface to notice if it silently isn't working

---

## Launch Day

- [ ] Announce on chosen channels
- [ ] Monitor Sentry and the worker heartbeat for the first 2 hours especially closely — a data-ingestion outage is easy to miss because the app still "works," it just silently goes stale
- [ ] Watch Vercel/Railway metrics for unexpected load, especially on `/api/hazards/map`
- [ ] Have someone on standby to hotfix
- [ ] Post a launch update / thank-you to early users

---

## Post-Launch (First 2 Weeks)

- [ ] Review onboarding funnel drop-off (signup → first Watch Location added)
- [ ] Gather qualitative feedback, especially from lower-tech-savvy users matching the primary persona — this product's core bet is simplicity, so watch for signs the interface is more complex than intended
- [ ] Fix top bugs and papercuts
- [ ] Review activation/engagement/retention metrics against the targets in the PRD §5
- [ ] Revisit the InciWeb integration assumption (Tech Spec §5) if it shipped in a degraded state — decide whether it's worth further investment
- [ ] Plan Phase 2 prioritization: native app vs. global weather coverage vs. flooding module

---

## Ongoing

- [ ] Weekly review of poller error logs specifically (not just general app errors) — these are the most likely silent-failure point
- [ ] Monthly dependency audit (`npm audit`)
- [ ] DB backups tested quarterly
- [ ] SSL cert expiry tracked
- [ ] Periodically re-verify each external API's terms/rate limits haven't changed (government APIs occasionally get re-platformed with new auth requirements)
