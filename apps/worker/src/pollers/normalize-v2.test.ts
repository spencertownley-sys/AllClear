import { describe, expect, it } from 'vitest';
import { normalizePerimeter } from './nifc-perimeters';
import { normalizeHistory } from './nifc-history';
import { classificationLabel, normalizeStorm } from './nhc';
import { normalizeUv, parseEpaDate } from './epa-uv';
import { degreesToCompass, parseWindMph } from './nws-weather';
import { bboxCenter, vertexCount } from '../geojson';
import { minIntervalMs, selectCandidates } from '../notify/select';
import type { NearbyHazardEvent, NotificationRule } from '@allclear/shared';

const now = new Date('2026-09-12T02:00:00Z');
const square = { type: 'Polygon', coordinates: [[[-122.0, 47.75], [-121.9, 47.75], [-121.9, 47.85], [-122.0, 47.85], [-122.0, 47.75]]] };

describe('geojson helpers', () => {
  it('computes a bbox centre and vertex count', () => {
    expect(bboxCenter(square)).toEqual({ latitude: 47.8, longitude: -121.95 });
    expect(vertexCount(square)).toBe(5);
  });
});

describe('NIFC perimeters', () => {
  it('normalizes a perimeter polygon with centroid and EWKT geometry', () => {
    const row = normalizePerimeter(
      { geometry: square, properties: { poly_IncidentName: 'Bear Creek', poly_GISAcres: 1199.6, attr_PercentContained: 40, attr_IrwinID: '{ABC}', attr_POOState: 'US-WA', poly_DateCurrent: Date.parse('2026-09-11T18:00:00Z') } },
      now,
    );
    expect(row).toMatchObject({ event_type: 'fire_perimeter', title: 'Bear Creek Fire', external_id: 'nifc-perim:{ABC}', latitude: 47.8, longitude: -121.95 });
    expect(row?.geometry).toBe('SRID=4326;POLYGON((-122 47.75,-121.9 47.75,-121.9 47.85,-122 47.85,-122 47.75))');
    expect(row?.attributes).toMatchObject({ acres: 1200, containment_pct: 40 });
  });
  it('skips features without geometry or a name', () => {
    expect(normalizePerimeter({ geometry: null, properties: { poly_IncidentName: 'X' } }, now)).toBeNull();
    expect(normalizePerimeter({ geometry: square, properties: {} }, now)).toBeNull();
  });
});

describe('NIFC history', () => {
  it('normalizes a historical perimeter with year and acres', () => {
    const row = normalizeHistory({ geometry: square, properties: { OBJECTID: 25569, INCIDENT: 'Scorpion', FIRE_YEAR_INT: 2017, GIS_ACRES: 695.24, UNQE_FIRE_ID: '2017-ORWIF-000247' } }, now);
    expect(row).toMatchObject({ event_type: 'fire_perimeter_historical', external_id: 'nifc-hist:25569', title: 'Scorpion Fire', occurred_at: '2017-07-01T00:00:00.000Z' });
    expect(row?.attributes).toMatchObject({ year: 2017, acres: 695 });
  });
});

describe('NHC', () => {
  it('normalizes an active storm', () => {
    const row = normalizeStorm({ id: 'ep142026', name: 'Norbert', classification: 'TS', intensity: '55', pressure: '996', latitudeNumeric: 17.2, longitudeNumeric: -126.6, movementDir: 285, movementSpeed: 12, lastUpdate: '2026-09-12T03:00:00.000Z', publicAdvisory: { url: 'https://www.nhc.noaa.gov/text/MIATCPEP4.shtml' } }, now);
    expect(row).toMatchObject({ source: 'nhc', event_type: 'tropical_cyclone', title: 'Tropical Storm Norbert', external_id: 'nhc:ep142026', latitude: 17.2, longitude: -126.6 });
    expect(row?.attributes).toMatchObject({ intensity_kt: 55, max_wind_mph: 63, pressure_mb: 996, movement_mph: 12 });
    expect(classificationLabel('HU')).toBe('Hurricane');
  });
});

describe('EPA UV', () => {
  it('parses EPA dates and normalizes the reading', () => {
    expect(parseEpaDate('Sep/12/2026')).toBe('2026-09-12');
    expect(parseEpaDate('bogus')).toBeNull();
    const row = normalizeUv([{ ZIP_CODE: '98101', CITY: 'Seattle', STATE: 'WA', UV_INDEX: '7', UV_ALERT: '0', DATE: 'Sep/12/2026' }], '98101', { latitude: 47.6, longitude: -122.3 }, now);
    expect(row).toMatchObject({ source: 'epa', event_type: 'uv_index', title: 'UV index 7 (High)', external_id: 'epa-uv:98101' });
    expect(row?.attributes).toMatchObject({ uv_index: 7, alert: false, date: '2026-09-12' });
  });
});

describe('wind helpers', () => {
  it('converts degrees to compass points and parses NWS wind strings', () => {
    expect(degreesToCompass(0)).toBe('N');
    expect(degreesToCompass(225)).toBe('SW');
    expect(degreesToCompass(359)).toBe('N');
    expect(degreesToCompass(null)).toBeNull();
    expect(parseWindMph('2 to 6 mph')).toBe(6);
    expect(parseWindMph('12 mph')).toBe(12);
    expect(parseWindMph(undefined)).toBeNull();
  });
});

describe('rule frequency', () => {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const rule = (partial: Partial<NotificationRule>): NotificationRule => ({ id: 'r', watch_location_id: 'l', layer_type: 'air_quality', condition_type: 'aqi_threshold', threshold_value: 101, channel: 'both', enabled: true, min_interval_minutes: null, created_at: '', updated_at: '', ...partial });
  const reading: NearbyHazardEvent = { id: 'a', source: 'airnow', external_id: 'x', event_type: 'aqi_reading', title: 'AQI', description: null, severity: null, latitude: 0, longitude: 0, magnitude: null, aqi: 150, occurred_at: hoursAgo(1), attributes: {}, fetched_at: '', expires_at: null, distance_miles: 2 };
  it('uses the default interval when the rule has none, and the rule value when set', () => {
    expect(minIntervalMs(rule({}))).toBe(6 * 3_600_000);
    expect(minIntervalMs(rule({ min_interval_minutes: 1440 }))).toBe(24 * 3_600_000);
    expect(minIntervalMs(rule({ condition_type: 'any_active', layer_type: 'official_alerts', threshold_value: null }))).toBe(0);
  });
  it('a daily rule stays quiet for 24 hours after the last notification', () => {
    const daily = rule({ min_interval_minutes: 1440 });
    expect(selectCandidates(daily, [reading], [{ hazard_event_id: 'old', sent_at: hoursAgo(7), event_type: 'aqi_reading' }], null, now)).toHaveLength(0);
    expect(selectCandidates(daily, [reading], [{ hazard_event_id: 'old', sent_at: hoursAgo(25), event_type: 'aqi_reading' }], null, now)).toHaveLength(1);
  });
  it('a daily cap also applies to official-alert rules', () => {
    const alerts = rule({ layer_type: 'official_alerts', condition_type: 'any_active', threshold_value: null, min_interval_minutes: 1440 });
    const alert: NearbyHazardEvent = { ...reading, id: 'al', event_type: 'severe_alert', source: 'nws', severity: 'Minor', title: 'Fog' };
    expect(selectCandidates(alerts, [alert], [{ hazard_event_id: 'other', sent_at: hoursAgo(2), event_type: 'severe_alert' }], null, now)).toHaveLength(0);
  });
});
