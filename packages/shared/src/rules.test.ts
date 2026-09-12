import { describe, expect, it } from 'vitest';
import { buildNotificationSummary, eventMatchesRule, severityRank } from './rules';
import type { NearbyHazardEvent, NotificationRule } from './types';

const baseRule: NotificationRule = {
  id: 'r1',
  watch_location_id: 'l1',
  layer_type: 'wildfire',
  condition_type: 'distance_threshold_miles',
  threshold_value: 25,
  channel: 'both',
  enabled: true,
  min_interval_minutes: null,
  created_at: '',
  updated_at: '',
};

function event(partial: Partial<NearbyHazardEvent>): NearbyHazardEvent {
  return {
    id: 'e1',
    source: 'firms',
    external_id: 'x',
    event_type: 'fire_hotspot',
    title: 'Hotspot',
    description: null,
    severity: null,
    latitude: 47.9,
    longitude: -122.1,
    magnitude: null,
    aqi: null,
    occurred_at: null,
    attributes: {},
    fetched_at: '',
    expires_at: null,
    distance_miles: 18,
    ...partial,
  };
}

describe('eventMatchesRule', () => {
  it('matches a hotspot inside the distance threshold', () => {
    expect(eventMatchesRule(baseRule, event({}), { distanceMiles: 18, radiusMiles: 25 })).toBe(true);
  });
  it('rejects a hotspot outside the threshold', () => {
    expect(eventMatchesRule(baseRule, event({}), { distanceMiles: 40, radiusMiles: 25 })).toBe(false);
  });
  it('ignores disabled rules', () => {
    expect(eventMatchesRule({ ...baseRule, enabled: false }, event({}), { distanceMiles: 1, radiusMiles: 25 })).toBe(false);
  });
  it('applies magnitude and radius for earthquakes', () => {
    const rule = { ...baseRule, layer_type: 'earthquake' as const, condition_type: 'magnitude_threshold' as const, threshold_value: 4.5 };
    const quake = event({ event_type: 'earthquake', magnitude: 5.1, source: 'usgs' });
    expect(eventMatchesRule(rule, quake, { distanceMiles: 45, radiusMiles: 100 })).toBe(true);
    expect(eventMatchesRule(rule, quake, { distanceMiles: 145, radiusMiles: 100 })).toBe(false);
    expect(eventMatchesRule(rule, event({ event_type: 'earthquake', magnitude: 3.2 }), { distanceMiles: 5, radiusMiles: 100 })).toBe(false);
  });
  it('applies AQI thresholds', () => {
    const rule = { ...baseRule, layer_type: 'air_quality' as const, condition_type: 'aqi_threshold' as const, threshold_value: 101 };
    expect(eventMatchesRule(rule, event({ event_type: 'aqi_reading', aqi: 142 }), { distanceMiles: 2, radiusMiles: null })).toBe(true);
    expect(eventMatchesRule(rule, event({ event_type: 'aqi_reading', aqi: 38 }), { distanceMiles: 2, radiusMiles: null })).toBe(false);
  });
  it('official alerts match any active alert, weather only Severe/Extreme', () => {
    const official = { ...baseRule, layer_type: 'official_alerts' as const, condition_type: 'any_active' as const, threshold_value: null };
    const weather = { ...official, layer_type: 'weather' as const };
    const minor = event({ event_type: 'severe_alert', severity: 'Minor', title: 'Dense Fog Advisory' });
    const severe = event({ event_type: 'severe_alert', severity: 'Severe', title: 'Red Flag Warning' });
    const ctx = { distanceMiles: 0, radiusMiles: null };
    expect(eventMatchesRule(official, minor, ctx)).toBe(true);
    expect(eventMatchesRule(weather, minor, ctx)).toBe(false);
    expect(eventMatchesRule(weather, severe, ctx)).toBe(true);
  });
  it('matches an active perimeter within the distance threshold', () => {
    expect(eventMatchesRule(baseRule, event({ event_type: 'fire_perimeter', source: 'inciweb' }), { distanceMiles: 3, radiusMiles: 25 })).toBe(true);
  });
  it('never matches an event type from another layer', () => {
    expect(eventMatchesRule(baseRule, event({ event_type: 'earthquake', magnitude: 6 }), { distanceMiles: 1, radiusMiles: 25 })).toBe(false);
  });
});

describe('buildNotificationSummary', () => {
  it('describes fires, quakes, AQI and alerts in plain language', () => {
    expect(buildNotificationSummary(baseRule, event({}), 'Home')).toBe('New wildfire hotspot detected 18 mi from Home');
    expect(
      buildNotificationSummary(
        baseRule,
        event({ event_type: 'fire_incident', title: 'Bear Creek Fire', attributes: { containment_pct: 40 } }),
        'Home',
      ),
    ).toBe('Bear Creek Fire (40% contained) is 18 mi from Home');
    expect(
      buildNotificationSummary(
        { ...baseRule, layer_type: 'earthquake', condition_type: 'magnitude_threshold' },
        event({ event_type: 'earthquake', magnitude: 4.5, distance_miles: 45 }),
        "Mom's House",
      ),
    ).toBe("M4.5 earthquake 45 mi from Mom's House");
    expect(
      buildNotificationSummary(
        baseRule,
        event({ event_type: 'fire_perimeter', title: 'Bear Creek Fire', attributes: { acres: 1200, containment_pct: 40 }, distance_miles: 3.2 }),
        'Home',
      ),
    ).toBe('Bear Creek Fire perimeter (1,200 acres, 40% contained) is 3.2 mi from Home');
    expect(
      buildNotificationSummary(
        { ...baseRule, layer_type: 'air_quality', condition_type: 'aqi_threshold' },
        event({ event_type: 'aqi_reading', aqi: 142 }),
        'Home',
      ),
    ).toBe('Air quality near Home is 142 (Unhealthy for Sensitive Groups)');
    expect(
      buildNotificationSummary(
        { ...baseRule, layer_type: 'weather', condition_type: 'any_active' },
        event({ event_type: 'severe_alert', title: 'Red Flag Warning', severity: 'Severe' }),
        'Home',
      ),
    ).toBe('Severe weather: Red Flag Warning issued for Home');
  });
});

describe('severityRank', () => {
  it('orders Extreme < Severe < Moderate < Minor < Unknown', () => {
    expect(severityRank('Extreme')).toBeLessThan(severityRank('Severe'));
    expect(severityRank('Severe')).toBeLessThan(severityRank('Moderate'));
    expect(severityRank('Minor')).toBeLessThan(severityRank(null));
  });
});
