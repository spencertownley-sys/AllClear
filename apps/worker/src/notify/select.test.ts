import { describe, expect, it } from 'vitest';
import type { NearbyHazardEvent, NotificationRule } from '@allclear/shared';
import { selectCandidates } from './select';

const now = new Date('2026-09-12T02:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function rule(partial: Partial<NotificationRule>): NotificationRule {
  return { id: 'r', watch_location_id: 'l', layer_type: 'wildfire', condition_type: 'distance_threshold_miles', threshold_value: 25, channel: 'both', enabled: true, min_interval_minutes: null, created_at: '', updated_at: '', ...partial };
}
function ev(partial: Partial<NearbyHazardEvent>): NearbyHazardEvent {
  return { id: Math.random().toString(36).slice(2), source: 'firms', external_id: 'x', event_type: 'fire_hotspot', title: 'Hotspot', description: null, severity: null, latitude: 0, longitude: 0, magnitude: null, aqi: null, occurred_at: hoursAgo(1), attributes: {}, fetched_at: '', expires_at: null, distance_miles: 10, ...partial };
}

describe('selectCandidates — wildfire', () => {
  it('rolls many fresh hotspots into a single notification with the nearest as the anchor', () => {
    const events = [ev({ distance_miles: 18 }), ev({ distance_miles: 12 }), ev({ distance_miles: 22 })];
    const out = selectCandidates(rule({}), events, [], 25, now);
    expect(out).toHaveLength(1);
    expect(out[0]?.hotspotCount).toBe(3);
    expect(out[0]?.event.distance_miles).toBe(12);
  });
  it('respects the 6h hotspot cooldown but still reports a new named incident', () => {
    const incident = ev({ id: 'inc1', event_type: 'fire_incident', title: 'Bear Creek Fire', source: 'inciweb' });
    const prior = [{ hazard_event_id: 'old', sent_at: hoursAgo(2), event_type: 'fire_hotspot' }];
    const out = selectCandidates(rule({}), [ev({}), incident], prior, 25, now);
    expect(out).toHaveLength(1);
    expect(out[0]?.event.id).toBe('inc1');
  });
  it('does not re-notify an incident already in the log', () => {
    const incident = ev({ id: 'inc1', event_type: 'fire_incident' });
    expect(selectCandidates(rule({}), [incident], [{ hazard_event_id: 'inc1', sent_at: hoursAgo(30), event_type: 'fire_incident' }], 25, now)).toHaveLength(0);
  });
  it('only counts hotspots newer than the last hotspot notification', () => {
    const prior = [{ hazard_event_id: 'old', sent_at: hoursAgo(7), event_type: 'fire_hotspot' }];
    const stale = ev({ occurred_at: hoursAgo(9) });
    const fresh = ev({ occurred_at: hoursAgo(3) });
    expect(selectCandidates(rule({}), [stale], prior, 25, now)).toHaveLength(0);
    expect(selectCandidates(rule({}), [stale, fresh], prior, 25, now)[0]?.hotspotCount).toBe(1);
  });
});

describe('selectCandidates — earthquakes, AQI, alerts', () => {
  it('notifies once per quake above threshold within the last 24h', () => {
    const r = rule({ layer_type: 'earthquake', condition_type: 'magnitude_threshold', threshold_value: 4.5 });
    const big = ev({ id: 'q1', event_type: 'earthquake', magnitude: 5.1, source: 'usgs', distance_miles: 40 });
    const old = ev({ id: 'q2', event_type: 'earthquake', magnitude: 6, source: 'usgs', occurred_at: hoursAgo(48) });
    const small = ev({ id: 'q3', event_type: 'earthquake', magnitude: 3, source: 'usgs' });
    expect(selectCandidates(r, [big, old, small], [], 100, now).map((c) => c.event.id)).toEqual(['q1']);
    expect(selectCandidates(r, [big], [{ hazard_event_id: 'q1', sent_at: hoursAgo(1), event_type: 'earthquake' }], 100, now)).toHaveLength(0);
  });
  it('applies the 6h AQI cooldown', () => {
    const r = rule({ layer_type: 'air_quality', condition_type: 'aqi_threshold', threshold_value: 101 });
    const reading = ev({ event_type: 'aqi_reading', aqi: 142, source: 'airnow' });
    expect(selectCandidates(r, [reading], [], null, now)).toHaveLength(1);
    expect(selectCandidates(r, [reading], [{ hazard_event_id: 'a', sent_at: hoursAgo(2), event_type: 'aqi_reading' }], null, now)).toHaveLength(0);
    expect(selectCandidates(r, [reading], [{ hazard_event_id: 'a', sent_at: hoursAgo(7), event_type: 'aqi_reading' }], null, now)).toHaveLength(1);
    expect(selectCandidates(r, [ev({ event_type: 'aqi_reading', aqi: 60 })], [], null, now)).toHaveLength(0);
  });
  it('notifies once per official alert', () => {
    const r = rule({ layer_type: 'official_alerts', condition_type: 'any_active', threshold_value: null });
    const alert = ev({ id: 'al1', event_type: 'severe_alert', severity: 'Minor', title: 'Dense Fog Advisory', source: 'nws' });
    expect(selectCandidates(r, [alert], [], null, now)).toHaveLength(1);
    expect(selectCandidates(r, [alert], [{ hazard_event_id: 'al1', sent_at: hoursAgo(1), event_type: 'severe_alert' }], null, now)).toHaveLength(0);
  });
});
