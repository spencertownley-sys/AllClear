# AllClear — UI/UX Design Notes

---

## 1. Design Philosophy

- **Tone:** Calm and trustworthy, not alarmist. This is a "peace of mind" product, not a doomscroll feed — even though the content is inherently hazard-related.
- **Key design values:** Clarity (a glance should answer "am I okay?"), transparency (every fact is sourced), restraint (the primary persona is a low-to-medium-tech-savvy user who should never feel overwhelmed).
- **Reference apps for aesthetic inspiration:** Watch Duty (calm, map-first, clear source labeling), Apple Weather (simple card-based hierarchy, generous whitespace), Linear (clean typography, restrained color use for status).

---

## 2. Design System

| Token | Value / Approach |
|---|---|
| Primary color | Deep teal `#0F6B66` — calm, distinct from alarm-red, used for primary actions and branding |
| Accent color | Amber `#F59E0B` — reserved for warning/advisory states only, never decorative |
| Alert color | Red `#DC2626` — reserved strictly for active warnings/danger states, never used elsewhere |
| Neutral scale | Tailwind's default slate scale |
| Font (headings) | Inter, semi-bold |
| Font (body) | Inter, regular |
| Border radius | 12px rounded (cards), 8px (buttons/inputs) |
| Spacing system | 4px base grid |
| Component library | shadcn/ui, customized with the tokens above |

> ⚠️ Assumption: exact color hex values are a reasonable starting point, not a brand-locked decision. Revisit once there's a logo/brand direction.

---

## 3. Screen-by-Screen Descriptions

### Screen: Marketing / Landing (logged out)
**Purpose:** Explain the product in one glance and convert to signup.
**Layout:** Full-width hero with a live (read-only) national map behind a headline; sign-up CTA above the fold; a short "how it works" section below.
**Key elements:**
- Top nav: logo, "Log In," "Sign Up" button
- Hero headline + one-sentence pitch + primary CTA
- Live national map preview (same data as the public Map screen, non-interactive teaser)

**States:**
- Loading: map tiles/hazard data load progressively; page shell renders immediately
- Error: if hazard data fails to load, the map still renders with base tiles and no overlay — never blocks the marketing page

**Primary CTA:** "Get Started" → Sign Up

---

### Screen: Sign Up / Log In
**Purpose:** Create an account or authenticate.
**Layout:** Centered single-column form, minimal distraction.
**Key elements:** Email + password fields, submit button, link to switch between sign up/log in.

**States:**
- Loading: submit button shows a spinner, disabled during request
- Error: inline validation errors below each field (never a generic alert box)

**Primary CTA:** "Sign Up" / "Log In"

---

### Screen: Onboarding
**Purpose:** Get a new user to their first value moment — one configured Watch Location — as fast as possible.
**Layout:** Two-step wizard: (1) "Add your first location" (search or map pin), (2) "What do you want to watch here?" (layer toggles, all on by default except one clear explanation that Official Alerts can't be turned off).
**Key elements:** Location search input with autocomplete, map pin drop as an alternative, layer toggle list with a one-line description per layer.

**States:**
- Empty: N/A — this screen only appears when the user has zero locations
- Loading: geocoding search results show a skeleton list
- Error: "couldn't find that location" inline message with a retry

**Primary CTA:** "Add to My Watch List" → lands on Dashboard

---

### Screen: Dashboard (Home)
**Purpose:** The default landing screen after login — a glanceable status for every Watch Location.
**Layout:** Vertical stack of Watch Location cards (single column on mobile, responsive grid on desktop). "+ Add Location" affordance always visible at the top or bottom of the stack.
**Key elements:**
- Top nav/bottom tab bar (see §4)
- One card per Watch Location, each showing: label, a compact current-conditions weather chip, badges for any active layers with something to report (e.g., "🔥 2 fires within 25mi," "AQI 142 – Unhealthy for Sensitive Groups"), and an always-visible official-alert indicator if one is active
- Tapping a card opens Location Detail

**States:**
- Empty: (only reachable if onboarding was skipped) a single prominent "Add your first location" card
- Loading: skeleton cards matching the real card layout
- Error: a card-level error state ("Couldn't load conditions for this location — Retry") that never takes down the rest of the dashboard

**Primary CTA:** Tap any card → Location Detail. Secondary: "+ Add Location."

---

### Screen: Location Detail
**Purpose:** Full breakdown of every enabled layer for one Watch Location.
**Layout:** Header with location label + edit/remove actions; below it, one section per enabled layer, each clearly titled and source-labeled.
**Key elements:**
- Weather section: current conditions, hourly strip, 7-day forecast, any active NWS alert banner
- Wildfire & Smoke section: mini map centered on the location with nearby fire markers, list of nearby fires with distance/containment/status
- Earthquake section: list of recent quakes within radius, magnitude and distance
- Air Quality section: current AQI with color-coded category and a one-line health note
- Official Alerts section: always shown, even if empty ("No active alerts for this location")
- Every section header includes a small "Source: [name]" label

**States:**
- Empty (per section): "No active [fires/quakes/alerts] near this location right now" — a reassuring empty state, not a blank gap
- Loading: section-level skeletons, sections populate independently as their data arrives
- Error: section-level error message with retry, isolated to that section

**Primary CTA:** None single dominant action — this is a browsing screen. Secondary actions: "Edit Layers," "Notification Settings for this location."

---

### Screen: Map (national/public)
**Purpose:** Browse hazards nationally without needing a saved location — also the public, shareable, no-login screen.
**Layout:** Full-screen interactive Leaflet map with a layer toggle control (Fires / Quakes) and a search bar to jump to a location.
**Key elements:** Map, layer toggle chips, search bar, a "Sign up to save this location" prompt that appears when an unauthenticated user searches a specific place.

**States:**
- Loading: map tiles load immediately; hazard overlays fade in once fetched
- Empty: N/A (map always renders; absence of markers simply means no active hazards in view)
- Error: overlay data failing to load shows a small non-blocking banner ("Live fire data temporarily unavailable"), map itself remains usable

**Primary CTA:** For logged-out users, "Sign Up" (contextual, appears on search). For logged-in users, "Add as Watch Location" (contextual, appears on search/pin-drop).

---

### Screen: Notification Settings
**Purpose:** Configure per-location, per-layer alert thresholds.
**Layout:** List of Watch Locations, each expandable to show its layer-specific threshold controls.
**Key elements:** Per layer: a simple slider or stepper for the threshold (distance in miles, magnitude, AQI value), a channel toggle (push/email/both), an on/off switch.

**States:**
- Empty: "Add a Watch Location first to set notification rules" if the user has none
- Loading: standard form skeleton
- Error: inline save-failure message with retry, changes not silently lost

**Primary CTA:** "Save" (per section or globally, whichever the implementation favors — recommend per-section auto-save with a brief confirmation toast to reduce friction for a low-tech-savvy user).

---

### Screen: Notification History ("Alerts")
**Purpose:** A log of past notifications sent, so a user can review what they missed.
**Layout:** Reverse-chronological list, grouped by day.
**Key elements:** Each entry shows the location, the layer/hazard type, the summary text, and timestamp.

**States:**
- Empty: "No alerts yet — you'll see them here once one of your notification rules is triggered"
- Loading: skeleton list rows
- Error: standard retry banner

**Primary CTA:** None — this is a passive log screen.

---

### Screen: Account Settings
**Purpose:** Manage account-level details.
**Layout:** Simple form sections: profile (email), Watch Locations management (list with remove option), danger zone (delete account).
**Key elements:** Standard settings form patterns; delete-account requires a confirmation dialog.

**States:** Standard loading/error/empty per template.

**Primary CTA:** "Save Changes." Destructive: "Delete Account" (behind confirmation).

---

## 4. Navigation Structure

```
AllClear
├── Marketing (logged out)
├── Sign Up / Log In
├── Onboarding (first-time only)
├── Dashboard (default landing after login)
│   └── Location Detail (per Watch Location)
├── Map (public, no login required)
├── Alerts (Notification History)
└── Settings
    ├── Notification Settings (per location)
    └── Account Settings
```

- **Nav type:** Bottom tab bar on mobile viewports (Dashboard / Map / Alerts / Settings — 4 tabs, matching the "web-first, mobile-ready" platform decision so the pattern transfers directly to a native app later); top nav on desktop with the same four destinations plus a user menu.
- **Auth gates:** Dashboard, Location Detail, Alerts, and Settings all require login. Marketing and Map are public.

---

## 5. Key Interaction Patterns

- **Forms:** validate inline on blur; errors appear directly below the relevant field, never as a top-of-page banner
- **Confirmations:** destructive actions (remove a Watch Location, delete account) require an explicit confirm dialog
- **Feedback:** every async action (save, add location, toggle a layer) shows a brief loading state and a success/error toast — silence after an action is never acceptable in a safety-adjacent product
- **Transitions:** minimal — fade for page transitions, slide-up for modals on mobile. No decorative animation that could read as "cute" for what is fundamentally a safety tool
- **Mobile:** touch targets ≥ 44px; bottom tab bar reachable with a thumb; map gestures (pinch-zoom, pan) standard Leaflet touch handling

---

## 6. Accessibility Notes

- Color contrast: AA compliant minimum, checked specifically for the alert-red and amber tokens against their backgrounds
- All interactive elements keyboard-navigable, including map layer toggles and dashboard cards
- All map markers/icons have text alternatives (not conveyed by color/icon alone) — critical given the primary persona skews lower-tech-savvy and may also skew older
- Form inputs have associated labels (not placeholder-only labels)
- Focus indicators visible on all interactive elements
- Screen-reader consideration: hazard severity should never be conveyed by color alone — always paired with text (e.g., "Warning" not just a red dot)

---

## 7. Wireframe Descriptions

### Dashboard Wireframe (mobile)

```
┌─────────────────────────────────┐
│  AllClear            [+ Add]    │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Home · Seattle, WA        │  │
│  │ 62°F, Cloudy              │  │
│  │ 🔥 1 fire within 25mi     │  │
│  │ AQI 38 · Good             │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Mom's House · Denver, CO  │  │
│  │ 71°F, Clear               │  │
│  │ No active hazards         │  │
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│  [Dashboard] [Map] [Alerts] [⚙] │
└─────────────────────────────────┘
```

### Location Detail Wireframe (mobile)

```
┌─────────────────────────────────┐
│  ← Home · Seattle, WA    [Edit] │
├─────────────────────────────────┤
│  WEATHER          Source: NWS   │
│  62°F Cloudy  [hourly strip]    │
│  [7-day forecast row]           │
├─────────────────────────────────┤
│  WILDFIRE & SMOKE  Source: FIRMS│
│  [mini map with fire markers]   │
│  • Bear Creek Fire — 18mi — 40% │
├─────────────────────────────────┤
│  AIR QUALITY      Source: AirNow│
│  AQI 38 · Good                  │
├─────────────────────────────────┤
│  OFFICIAL ALERTS      Source:NWS│
│  No active alerts                │
└─────────────────────────────────┘
```

_(ASCII wireframes are for layout clarity, not visual fidelity.)_
