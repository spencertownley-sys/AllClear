import { NWS_SEVERITY_ORDER, type ConditionType } from './constants';
import { aqiCategory } from './aqi';
import { formatMiles } from './geo';
import type { CachedHazardEvent, NearbyHazardEvent, NotificationRule } from './types';

export interface RuleMatchContext {
  /** Distance from the Watch Location to the event, in miles (null when the event has no point). */
  distanceMiles: number | null;
  /** The location's configured radius for the rule's layer (used for earthquakes). */
  radiusMiles: number | null;
}

/** Numeric rank for NWS severities — lower is more severe. */
export function severityRank(severity: string | null | undefined): number {
  const idx = NWS_SEVERITY_ORDER.indexOf((severity ?? 'Unknown') as (typeof NWS_SEVERITY_ORDER)[number]);
  return idx === -1 ? NWS_SEVERITY_ORDER.length : idx;
}

export function isSevereWeatherAlert(event: Pick<CachedHazardEvent, 'event_type' | 'severity'>): boolean {
  return event.event_type === 'severe_alert' && severityRank(event.severity) <= 1;
}

/**
 * Pure predicate: does this event satisfy this rule?
 * Callers are responsible for only passing events that are relevant to the rule's location
 * (i.e. already filtered by proximity / nearest reading).
 */
export function eventMatchesRule(
  rule: Pick<NotificationRule, 'layer_type' | 'condition_type' | 'threshold_value' | 'enabled'>,
  event: Pick<CachedHazardEvent, 'event_type' | 'severity' | 'magnitude' | 'aqi'>,
  ctx: RuleMatchContext,
): boolean {
  if (!rule.enabled) return false;
  switch (rule.condition_type) {
    case 'distance_threshold_miles': {
      if (rule.layer_type !== 'wildfire') return false;
      if (event.event_type !== 'fire_hotspot' && event.event_type !== 'fire_incident' && event.event_type !== 'fire_perimeter') {
        return false;
      }
      if (ctx.distanceMiles === null || rule.threshold_value === null) return false;
      return ctx.distanceMiles <= rule.threshold_value;
    }
    case 'magnitude_threshold': {
      if (rule.layer_type !== 'earthquake' || event.event_type !== 'earthquake') return false;
      if (event.magnitude === null || rule.threshold_value === null) return false;
      if (event.magnitude < rule.threshold_value) return false;
      if (ctx.radiusMiles !== null && ctx.distanceMiles !== null && ctx.distanceMiles > ctx.radiusMiles) {
        return false;
      }
      return true;
    }
    case 'aqi_threshold': {
      if (rule.layer_type !== 'air_quality' || event.event_type !== 'aqi_reading') return false;
      if (event.aqi === null || rule.threshold_value === null) return false;
      return event.aqi >= rule.threshold_value;
    }
    case 'any_active': {
      if (event.event_type !== 'severe_alert') return false;
      if (rule.layer_type === 'official_alerts') return true;
      if (rule.layer_type === 'weather') return isSevereWeatherAlert(event);
      return false;
    }
    default:
      return false;
  }
}

/** Minimum time between two notifications for the same rule, per condition type. */
export const RULE_COOLDOWN_MS: Record<ConditionType, number> = {
  distance_threshold_miles: 0, // de-duplicated per event instead
  magnitude_threshold: 0, // de-duplicated per event instead
  aqi_threshold: 6 * 60 * 60 * 1000,
  any_active: 0, // de-duplicated per event instead
};

/** The human-readable message that gets pushed / emailed and stored in notifications_log. */
export function buildNotificationSummary(
  rule: Pick<NotificationRule, 'layer_type' | 'condition_type'>,
  event: Pick<
    NearbyHazardEvent,
    'event_type' | 'title' | 'severity' | 'magnitude' | 'aqi' | 'attributes' | 'distance_miles'
  >,
  locationLabel: string,
): string {
  const dist = formatMiles(event.distance_miles);
  switch (event.event_type) {
    case 'fire_hotspot':
      return `New wildfire hotspot detected ${dist} from ${locationLabel}`;
    case 'fire_incident': {
      const pct = event.attributes['containment_pct'];
      const contained = typeof pct === 'number' ? ` (${Math.round(pct)}% contained)` : '';
      return `${event.title}${contained} is ${dist} from ${locationLabel}`;
    }
    case 'fire_perimeter': {
      const acres = event.attributes['acres'];
      const pct = event.attributes['containment_pct'];
      const parts = [
        typeof acres === 'number' ? `${Math.round(acres).toLocaleString('en-US')} acres` : null,
        typeof pct === 'number' ? `${Math.round(pct)}% contained` : null,
      ].filter(Boolean);
      const detail = parts.length ? ` (${parts.join(', ')})` : '';
      return `${event.title} perimeter${detail} is ${dist} from ${locationLabel}`;
    }
    case 'earthquake': {
      const mag = event.magnitude !== null ? `M${event.magnitude.toFixed(1)}` : 'An';
      return `${mag} earthquake ${dist} from ${locationLabel}`;
    }
    case 'aqi_reading': {
      const value = event.aqi ?? 0;
      return `Air quality near ${locationLabel} is ${value} (${aqiCategory(value).name})`;
    }
    case 'severe_alert': {
      const prefix = rule.layer_type === 'weather' ? 'Severe weather: ' : '';
      return `${prefix}${event.title} issued for ${locationLabel}`;
    }
    default:
      return `${event.title} near ${locationLabel}`;
  }
}
