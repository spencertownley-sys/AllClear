# AllClear — API Design

---

## 1. Overview

- **API style:** REST, implemented as Next.js API routes (App Router route handlers)
- **Base URL:** `/api` (same-origin, monorepo — no separate API domain for MVP)
- **Auth:** Supabase session cookie, validated server-side on every protected route; no separate bearer-token scheme needed since the frontend and API share an origin
- **Content type:** `application/json`
- **Versioning strategy:** none for MVP (single consumer — our own frontend); revisit with a `/v1/` prefix if a public API or the native app becomes a separate consumer with its own release cadence

---

## 2. Authentication

Authentication itself is handled by Supabase Auth's client SDK directly from the frontend (sign up, log in, log out, session refresh) rather than custom API routes — there is no need to reimplement `/auth/signup` or `/auth/login` when Supabase already provides this. Every API route below assumes a valid Supabase session is present; routes that require one return `401 UNAUTHORIZED` otherwise.

---

## 3. Watch Locations

### GET /api/locations
List all Watch Locations for the authenticated user.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Home",
      "latitude": 47.6062,
      "longitude": -122.3321,
      "city_name": "Seattle",
      "state": "WA",
      "country": "US",
      "is_primary": true,
      "created_at": "2026-09-01T12:00:00Z"
    }
  ]
}
```

---

### POST /api/locations
Create a new Watch Location.

**Request:**
```json
{
  "label": "Mom's House",
  "latitude": 39.7392,
  "longitude": -104.9903,
  "city_name": "Denver",
  "state": "CO",
  "country": "US"
}
```

**Response 201:** the created location object (same shape as above)

**Errors:** 400 (invalid/missing lat-lng), 401 (not authenticated)

---

### GET /api/locations/:id
Fetch a single Watch Location.
**Response 200 / 404**

---

### PATCH /api/locations/:id
Update a Watch Location (label, is_primary, etc.). Partial update.
**Response 200 / 404 / 403**

---

### DELETE /api/locations/:id
Remove a Watch Location. Cascades to its `location_layers` and `notification_rules`.
**Response 204 / 404 / 403**

---

## 4. Location Layers

### GET /api/locations/:id/layers
List enabled/disabled layers and radius settings for a location.

**Response 200:**
```json
{
  "data": [
    { "layer_type": "weather", "enabled": true, "radius_miles": null },
    { "layer_type": "wildfire", "enabled": true, "radius_miles": 25 },
    { "layer_type": "earthquake", "enabled": true, "radius_miles": 100 },
    { "layer_type": "air_quality", "enabled": true, "radius_miles": null }
  ]
}
```
Note: `official_alerts` is not represented here — it is always on and is not a user-toggleable layer.

---

### PUT /api/locations/:id/layers
Replace the full layer configuration for a location (simpler than PATCH-per-layer given the small, fixed set of layer types).

**Request:** same shape as the GET response's `data` array
**Response 200:** the updated configuration
**Errors:** 400 (invalid layer_type or radius), 401, 403, 404

---

## 5. Hazard Data (Read)

### GET /api/locations/:id/hazards
The core aggregation endpoint — returns current hazard data for every enabled layer at this location, plus always-on official alerts. This reads exclusively from `cached_hazard_events` and the weather cache; it never calls an external API synchronously.

**Response 200:**
```json
{
  "weather": {
    "current": { "temp_f": 62, "conditions": "Cloudy", "source": "nws", "fetched_at": "..." },
    "hourly": [ { "time": "...", "temp_f": 61, "conditions": "..." } ],
    "daily": [ { "date": "...", "high_f": 68, "low_f": 54, "conditions": "..." } ]
  },
  "wildfire": {
    "hotspots": [ { "latitude": 47.9, "longitude": -122.1, "distance_miles": 18, "source": "firms" } ],
    "incidents": [ { "name": "Bear Creek Fire", "containment_pct": 40, "acres": 1200, "distance_miles": 18, "source": "inciweb" } ]
  },
  "earthquakes": [ { "magnitude": 3.2, "distance_miles": 45, "occurred_at": "...", "source": "usgs" } ],
  "air_quality": { "aqi": 38, "category": "Good", "source": "airnow", "fetched_at": "..." },
  "official_alerts": [ { "event": "Red Flag Warning", "severity": "Warning", "expires_at": "...", "source": "nws" } ]
}
```
Each top-level key is present only if that layer is enabled for the location, except `official_alerts`, which is always present (as an empty array if none are active).

**Errors:** 401, 403 (location belongs to another user), 404

---

### GET /api/hazards/map
**Public, unauthenticated.** Returns fire and earthquake data for the national map view, filtered by a bounding box query parameter.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `bbox` | string | `minLng,minLat,maxLng,maxLat` |
| `layers` | string | comma-separated: `fires,quakes` (default: both) |

**Response 200:**
```json
{
  "data": {
    "fires": [ { "latitude": 47.9, "longitude": -122.1, "source": "firms" } ],
    "quakes": [ { "latitude": 34.1, "longitude": -118.2, "magnitude": 4.1, "source": "usgs" } ]
  }
}
```

**Rate limiting:** this is the one endpoint reachable without authentication — apply IP-based rate limiting here specifically (see §6).

---

## 6. Notification Rules

### GET /api/locations/:id/notification-rules
List notification rules for a location.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "layer_type": "wildfire",
      "condition_type": "distance_threshold_miles",
      "threshold_value": 25,
      "channel": "both",
      "enabled": true
    }
  ]
}
```

---

### POST /api/locations/:id/notification-rules
Create a rule.

**Request:**
```json
{
  "layer_type": "earthquake",
  "condition_type": "magnitude_threshold",
  "threshold_value": 4.5,
  "channel": "web_push"
}
```
**Response 201:** the created rule
**Errors:** 400 (invalid layer_type/condition_type combination — e.g., `magnitude_threshold` is only valid for `earthquake`), 401, 403

---

### PATCH /api/locations/:id/notification-rules/:ruleId
Update a rule (threshold, channel, enabled). Partial update.
**Response 200 / 404 / 403**

---

### DELETE /api/locations/:id/notification-rules/:ruleId
Remove a rule.
**Response 204 / 404 / 403**

---

## 7. Notifications (History)

### GET /api/notifications
List the authenticated user's notification history, most recent first.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `page` | int | default 1 |
| `limit` | int | default 20, max 100 |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "watch_location_label": "Home",
      "summary": "New wildfire detected 18 miles from Home",
      "channel": "web_push",
      "sent_at": "..."
    }
  ],
  "meta": { "page": 1, "total": 12 }
}
```

---

## 8. Error Format

All errors follow a consistent shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ { "field": "latitude", "message": "Must be between -90 and 90" } ]
  }
}
```

### Standard Error Codes
| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Authenticated but this resource belongs to another user |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Duplicate or state conflict (e.g., duplicate notification rule) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## 9. Rate Limiting

- **Authenticated endpoints:** 100 requests/minute per user — generous, since normal usage is far below this
- **`GET /api/hazards/map` (public):** 60 requests/minute per IP — the one endpoint exposed without auth, needs its own tighter ceiling to prevent scraping/abuse
- **Headers returned:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Behavior when exceeded:** `429` response using the standard error format

---

## 10. Webhooks

Not applicable for MVP. AllClear is entirely pull-based: the worker polls external hazard APIs on a schedule (see Tech Spec §5) rather than receiving webhooks from them, since none of NWS, FIRMS, USGS, AirNow, or InciWeb offer a webhook/push subscription model to third parties. Revisit this section only if a future integration (e.g., a licensed public-safety incident feed) offers webhook delivery.
