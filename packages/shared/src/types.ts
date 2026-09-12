import type {
  Channel,
  ConditionType,
  DeliveryChannel,
  EventType,
  HazardSource,
  LayerType,
  NotificationLayerType,
} from './constants';

// ---------- Database rows ----------

export interface WatchLocation {
  id: string;
  user_id: string;
  label: string;
  latitude: number;
  longitude: number;
  city_name: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationLayer {
  id: string;
  watch_location_id: string;
  layer_type: LayerType;
  enabled: boolean;
  radius_miles: number | null;
  min_magnitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  watch_location_id: string;
  layer_type: NotificationLayerType;
  condition_type: ConditionType;
  threshold_value: number | null;
  channel: Channel;
  enabled: boolean;
  /** Minimum minutes between notifications for this rule; null = every new event. */
  min_interval_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface CachedHazardEvent {
  id: string;
  source: HazardSource;
  external_id: string;
  event_type: EventType;
  title: string;
  description: string | null;
  severity: string | null;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  aqi: number | null;
  occurred_at: string | null;
  attributes: Record<string, unknown>;
  raw_payload: unknown;
  fetched_at: string;
  expires_at: string | null;
}

/** A hazard event returned by a proximity query, with the computed distance. */
export interface NearbyHazardEvent extends Omit<CachedHazardEvent, 'raw_payload'> {
  distance_miles: number;
}

export interface WeatherCurrent {
  temp_f: number | null;
  conditions: string;
  humidity_pct: number | null;
  wind_mph: number | null;
  /** Compass direction the wind blows from, e.g. "SW". */
  wind_dir: string | null;
  wind_gust_mph: number | null;
  icon: string | null;
  observed_at: string | null;
  station: string | null;
  /** 'observation' when it came from a station, 'forecast' when derived from the first hourly period. */
  basis: 'observation' | 'forecast';
}

export interface WeatherHourly {
  time: string;
  temp_f: number | null;
  conditions: string;
  precip_pct: number | null;
  icon: string | null;
  wind_mph: number | null;
  wind_dir: string | null;
}

export interface WeatherDaily {
  date: string;
  name: string;
  high_f: number | null;
  low_f: number | null;
  conditions: string;
  precip_pct: number | null;
  icon: string | null;
  detailed: string | null;
}

export interface CachedWeather {
  id: string;
  grid_key: string;
  latitude: number;
  longitude: number;
  city_name: string | null;
  state: string | null;
  time_zone: string | null;
  current: WeatherCurrent | null;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  source: HazardSource;
  fetched_at: string;
  expires_at: string | null;
}

export interface NotificationLogEntry {
  id: string;
  user_id: string;
  watch_location_id: string | null;
  notification_rule_id: string | null;
  hazard_event_id: string | null;
  layer_type: NotificationLayerType | null;
  summary: string;
  channel: DeliveryChannel;
  sent_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  failure_count: number;
}

export interface PollerRun {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error';
  rows_upserted: number;
  error: string | null;
  details: Record<string, unknown>;
}

// ---------- API DTOs (see docs/AllClear-API_DESIGN.md) ----------

export interface LocationDTO {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  city_name: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_primary: boolean;
  created_at: string;
}

export interface LayerConfigDTO {
  layer_type: LayerType;
  enabled: boolean;
  radius_miles: number | null;
  /** Only meaningful for the earthquake layer. Additive to the API doc; see PRD §3.4. */
  min_magnitude?: number | null;
}

export interface UvDTO {
  uv_index: number;
  category: string;
  alert: boolean;
  date: string | null;
  source: HazardSource;
  fetched_at: string;
  stale: boolean;
}

export interface WeatherDTO {
  current: (WeatherCurrent & { source: HazardSource; fetched_at: string }) | null;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  source: HazardSource;
  fetched_at: string | null;
  stale: boolean;
  uv: UvDTO | null;
}

export interface HotspotDTO {
  id: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  detected_at: string | null;
  confidence: string | null;
  satellite: string | null;
  source: HazardSource;
}

export interface IncidentDTO {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  containment_pct: number | null;
  acres: number | null;
  status: string | null;
  updated_at: string | null;
  url: string | null;
  source: HazardSource;
}

/** An active fire perimeter polygon (NIFC WFIGS). */
export interface PerimeterDTO {
  id: string;
  name: string;
  acres: number | null;
  containment_pct: number | null;
  /** Miles from the location to the nearest edge of the perimeter (0 when inside). */
  distance_miles: number;
  updated_at: string | null;
  geojson: GeoJsonGeometry;
  source: HazardSource;
}

/** A past fire perimeter within the location's radius (NIFC history, last 10 years). */
export interface HistoricalFireDTO {
  id: string;
  name: string;
  year: number | null;
  acres: number | null;
  distance_miles: number;
  geojson: GeoJsonGeometry;
  source: HazardSource;
}

export interface StormDTO {
  id: string;
  name: string;
  classification: string;
  intensity_kt: number | null;
  pressure_mb: number | null;
  latitude: number;
  longitude: number;
  movement_dir: number | null;
  movement_mph: number | null;
  distance_miles: number | null;
  last_update: string | null;
  url: string | null;
  source: HazardSource;
}

export type GeoJsonGeometry = { type: string; coordinates: unknown };

export interface EarthquakeDTO {
  id: string;
  magnitude: number;
  place: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  occurred_at: string;
  url: string | null;
  source: HazardSource;
}

export interface AirQualityDTO {
  aqi: number;
  category: string;
  pollutant: string | null;
  reporting_area: string | null;
  distance_miles: number;
  observed_at: string | null;
  source: HazardSource;
  fetched_at: string;
  stale: boolean;
}

export interface OfficialAlertDTO {
  id: string;
  event: string;
  headline: string | null;
  severity: string;
  urgency: string | null;
  description: string | null;
  instruction: string | null;
  onset_at: string | null;
  expires_at: string | null;
  sender: string | null;
  source: HazardSource;
}

export interface LocationHazardsResponse {
  weather?: WeatherDTO;
  wildfire?: {
    hotspots: HotspotDTO[];
    incidents: IncidentDTO[];
    perimeters: PerimeterDTO[];
    history: HistoricalFireDTO[];
    cameras_url: string;
    radius_miles: number;
    stale: boolean;
  };
  storms?: StormDTO[];
  earthquakes?: {
    events: EarthquakeDTO[];
    radius_miles: number;
    min_magnitude: number;
    stale: boolean;
  };
  air_quality?: AirQualityDTO | null;
  official_alerts: OfficialAlertDTO[];
}

export interface MapFireDTO {
  latitude: number;
  longitude: number;
  detected_at: string | null;
  source: HazardSource;
  /** 'hotspot' for satellite detections, 'incident' for named NIFC fires */
  kind: 'hotspot' | 'incident';
  name?: string;
  containment_pct?: number | null;
  acres?: number | null;
}

export interface MapQuakeDTO {
  latitude: number;
  longitude: number;
  magnitude: number;
  place: string;
  occurred_at: string;
  source: HazardSource;
}

export interface MapPerimeterDTO {
  id: string;
  name: string;
  acres: number | null;
  containment_pct: number | null;
  updated_at: string | null;
  geojson: GeoJsonGeometry;
  source: HazardSource;
}

export interface MapResponse {
  data: {
    fires: MapFireDTO[];
    quakes: MapQuakeDTO[];
    perimeters: MapPerimeterDTO[];
    storms: StormDTO[];
  };
  meta: {
    fires_updated_at: string | null;
    quakes_updated_at: string | null;
    perimeters_updated_at: string | null;
    storms_updated_at: string | null;
  };
}

export interface NotificationRuleDTO {
  id: string;
  layer_type: NotificationLayerType;
  condition_type: ConditionType;
  threshold_value: number | null;
  channel: Channel;
  enabled: boolean;
  min_interval_minutes: number | null;
}

export interface NotificationHistoryItemDTO {
  id: string;
  watch_location_label: string;
  layer_type: NotificationLayerType | null;
  summary: string;
  channel: DeliveryChannel;
  sent_at: string;
}

export interface DashboardSummaryRow {
  location_id: string;
  fire_count: number;
  incident_count: number;
  quake_count: number;
  max_quake_magnitude: number | null;
  aqi: number | null;
  alert_count: number;
  top_alert_event: string | null;
  top_alert_severity: string | null;
  weather_current: WeatherCurrent | null;
  weather_fetched_at: string | null;
}

export interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
  city_name: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
}
