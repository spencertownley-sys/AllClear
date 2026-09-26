export const LAYER_TYPES = ['weather', 'wildfire', 'earthquake', 'air_quality'] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export const NOTIFICATION_LAYER_TYPES = [
  'weather',
  'wildfire',
  'earthquake',
  'air_quality',
  'official_alerts',
] as const;
export type NotificationLayerType = (typeof NOTIFICATION_LAYER_TYPES)[number];

export const CONDITION_TYPES = [
  'distance_threshold_miles',
  'magnitude_threshold',
  'aqi_threshold',
  'any_active',
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CHANNELS = ['web_push', 'email', 'both'] as const;
export type Channel = (typeof CHANNELS)[number];

export const DELIVERY_CHANNELS = ['web_push', 'email'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const HAZARD_SOURCES = ['nws', 'firms', 'inciweb', 'usgs', 'airnow', 'epa', 'nhc', 'open_meteo', 'cpc', 'nesdis'] as const;
export type HazardSource = (typeof HAZARD_SOURCES)[number];

export const EVENT_TYPES = [
  'severe_alert',
  'fire_hotspot',
  'fire_incident',
  'fire_perimeter',
  'fire_perimeter_historical',
  'smoke_plume',
  'earthquake',
  'aqi_reading',
  'uv_index',
  'tropical_cyclone',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** NOAA/NESDIS Hazard Mapping System qualitative smoke density. */
export const SMOKE_DENSITIES = ['light', 'medium', 'heavy'] as const;
export type SmokeDensity = (typeof SMOKE_DENSITIES)[number];
export const SMOKE_DENSITY_LABELS: Record<SmokeDensity, string> = {
  light: 'Light smoke',
  medium: 'Medium smoke',
  heavy: 'Heavy smoke',
};

/** Human-readable label for every data source, shown on every card ("Source: NWS"). */
export const SOURCE_LABELS: Record<HazardSource, string> = {
  nws: 'NWS',
  firms: 'NASA FIRMS',
  inciweb: 'NIFC / InciWeb',
  usgs: 'USGS',
  airnow: 'AirNow',
  epa: 'EPA',
  nhc: 'NOAA NHC',
  open_meteo: 'Open-Meteo',
  cpc: 'NOAA CPC',
  nesdis: 'NOAA/NESDIS (HMS)',
};

export const LAYER_LABELS: Record<NotificationLayerType, string> = {
  weather: 'Weather',
  wildfire: 'Wildfire & Smoke',
  earthquake: 'Earthquakes',
  air_quality: 'Air Quality',
  official_alerts: 'Official Alerts',
};

/** One-line explanation per layer, used in onboarding. */
export const LAYER_DESCRIPTIONS: Record<NotificationLayerType, string> = {
  weather: 'Current conditions, hourly and 7-day forecast from the National Weather Service.',
  wildfire: 'Satellite hotspots (NASA FIRMS) and named incidents (NIFC) within your chosen radius.',
  earthquake: 'Recent USGS earthquakes within your chosen radius, above a magnitude you pick.',
  air_quality: 'Current Air Quality Index from AirNow, with the standard color-coded category.',
  official_alerts:
    'Active NWS watches, warnings and advisories for this location. Always on — this is the safety net.',
};

export const DEFAULT_RADIUS_MILES: Record<LayerType, number | null> = {
  weather: null,
  wildfire: 25,
  earthquake: 100,
  air_quality: null,
};

export const DEFAULT_MIN_MAGNITUDE = 2.5;

export const RADIUS_LIMITS = { min: 1, max: 500 } as const;
export const MAGNITUDE_LIMITS = { min: 0, max: 10 } as const;
export const AQI_LIMITS = { min: 0, max: 500 } as const;

/** Which condition types are valid for which notification layer. */
export const VALID_RULE_COMBOS: Record<NotificationLayerType, readonly ConditionType[]> = {
  wildfire: ['distance_threshold_miles'],
  earthquake: ['magnitude_threshold'],
  air_quality: ['aqi_threshold'],
  official_alerts: ['any_active'],
  weather: ['any_active'],
};

/** Sensible starting thresholds when a user creates a rule. */
export const DEFAULT_THRESHOLDS: Record<ConditionType, number | null> = {
  distance_threshold_miles: 25,
  magnitude_threshold: 4.0,
  aqi_threshold: 101,
  any_active: null,
};

/** How long each source's cached rows are considered fresh before the UI flags them as stale. */
export const SOURCE_STALE_AFTER_MS: Record<HazardSource, number> = {
  nws: 45 * 60 * 1000,
  firms: 60 * 60 * 1000,
  inciweb: 2 * 60 * 60 * 1000,
  usgs: 15 * 60 * 1000,
  airnow: 2 * 60 * 60 * 1000,
  epa: 26 * 60 * 60 * 1000,
  nhc: 2 * 60 * 60 * 1000,
  open_meteo: 4 * 60 * 60 * 1000,
  cpc: 30 * 60 * 60 * 1000,
  nesdis: 3 * 60 * 60 * 1000,
};

/** Days of daily forecast shown (NWS covers the first 7, Open-Meteo the rest). */
export const FORECAST_DAYS = 16;

/** NWS CAP severity ordering, most severe first. */
export const NWS_SEVERITY_ORDER = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'] as const;
export type NwsSeverity = (typeof NWS_SEVERITY_ORDER)[number];

/** Grid-cell sizes (degrees) the worker uses to batch per-point polling. */
export const CELL_SIZE_DEG = {
  weather: 0.05, // ~3.5 mi — NWS gridpoints are 2.5 km
  alerts: 0.1, // ~7 mi
  aqi: 0.1, // AirNow "current by lat/long" already searches within 25 mi
  history: 0.5, // ~35 mi — fire perimeter history is fetched per coarse cell
  outlook: 1, // ~70 mi — CPC outlook polygons are regional, one lookup covers many weather cells
} as const;

/** How often a rule may notify again. `null` = every new event (subject to per-event de-duplication). */
export const RULE_FREQUENCY_OPTIONS = [
  { label: 'Every update', minutes: null },
  { label: 'Every 6 hours', minutes: 360 },
  { label: 'Once a day', minutes: 1440 },
] as const;

/** Default minimum interval between notifications when the rule doesn't set one. */
export const DEFAULT_MIN_INTERVAL_MINUTES: Record<ConditionType, number | null> = {
  distance_threshold_miles: 360, // hotspot roll-ups; named incidents still notify once each
  magnitude_threshold: null,
  aqi_threshold: 360,
  any_active: null,
};

/** Radius used to surface tropical cyclones on a location's page. */
export const STORM_RADIUS_MILES = 500;
/** How far back the fire-history layer looks by default (years). */
export const FIRE_HISTORY_YEARS = 10;
/** The furthest back a user can ask for; the worker caches this much history. */
export const FIRE_HISTORY_MAX_YEARS = 25;
export const FIRE_HISTORY_YEAR_OPTIONS = [10, 15, 20, 25] as const;
/** Nationwide history is cached only for fires at least this big (acres); near Watch Locations every size is kept. */
export const FIRE_HISTORY_NATIONAL_MIN_ACRES = 1000;

export const CAMERA_NETWORK_URL = 'https://www.alertwildfire.org/';

export const MILES_PER_METER = 1 / 1609.344;
