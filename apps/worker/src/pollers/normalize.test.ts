import { describe, expect, it } from 'vitest';
import { normalizeUsgs } from './usgs';
import { normalizeFirms, parseFirmsCsv } from './firms';
import { normalizeNwsAlert } from './nws-alerts';
import { normalizeCurrent, normalizeDaily, normalizeHourly, type NwsPeriod } from './nws-weather';
import { normalizeAirNow, observedAt } from './airnow';
import { normalizeInciwebItem, normalizeNifc, parseInciwebDescription } from './nifc';
import { geojsonToEwkt } from '../geojson';

const now = new Date('2026-09-12T02:00:00Z');

describe('USGS', () => {
  it('normalizes a feature into an earthquake event with a 7-day TTL', () => {
    const row = normalizeUsgs(
      {
        id: 'us7000tgvr',
        geometry: { type: 'Point', coordinates: [-122.55, 47.65, 10] },
        properties: { mag: 3.2, place: '12 km NE of Bremerton, WA', time: Date.parse('2026-09-11T20:00:00Z'), url: 'https://example/quake', title: 'M 3.2 - 12 km NE of Bremerton, WA', type: 'earthquake' },
      },
      now,
    );
    expect(row).toMatchObject({ source: 'usgs', event_type: 'earthquake', magnitude: 3.2, latitude: 47.65, longitude: -122.55, external_id: 'us7000tgvr' });
    expect(row?.occurred_at).toBe('2026-09-11T20:00:00.000Z');
    expect(row?.expires_at).toBe('2026-09-18T20:00:00.000Z');
    expect((row?.attributes as Record<string, unknown>).depth_km).toBe(10);
  });
  it('skips quarry blasts and features without magnitude', () => {
    expect(normalizeUsgs({ id: 'x', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { mag: null, place: null, time: 1 } }, now)).toBeNull();
    expect(normalizeUsgs({ id: 'x', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { mag: 1, place: null, time: 1, type: 'quarry blast' } }, now)).toBeNull();
  });
});

describe('FIRMS', () => {
  const csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
47.72,-122.05,331.2,0.39,0.36,2026-09-11,2105,N,VIIRS,n,2.0NRT,289.1,3.4,N
bad,row,,,,,,,,,,,,`;
  it('parses the CSV by header and normalizes rows', () => {
    const rows = parseFirmsCsv(csv);
    expect(rows).toHaveLength(2);
    const event = normalizeFirms(rows[0]!, 'VIIRS_SNPP_NRT', now);
    expect(event).toMatchObject({ source: 'firms', event_type: 'fire_hotspot', latitude: 47.72, longitude: -122.05 });
    expect(event?.occurred_at).toBe('2026-09-11T21:05:00.000Z');
    expect(event?.expires_at).toBe('2026-09-12T21:05:00.000Z');
    expect(normalizeFirms(rows[1]!, 'VIIRS_SNPP_NRT', now)).toBeNull();
  });
  it('rejects non-CSV responses such as "Invalid MAP_KEY."', () => {
    expect(() => parseFirmsCsv('Invalid MAP_KEY.')).toThrow(/Unexpected FIRMS/);
  });
});

describe('NWS alerts', () => {
  const cell = { key: '47.6,-122.3', latitude: 47.6, longitude: -122.3 };
  it('stores zone alerts at the polled cell and polygon alerts as EWKT geometry', () => {
    const zone = normalizeNwsAlert(
      { id: 'a', geometry: null, properties: { id: 'urn:1', event: 'Red Flag Warning', severity: 'Severe', status: 'Actual', ends: '2026-09-12T10:00:00Z', headline: 'Red Flag Warning issued', senderName: 'NWS Seattle' } },
      cell,
      now,
    );
    expect(zone).toMatchObject({ event_type: 'severe_alert', title: 'Red Flag Warning', latitude: 47.6, longitude: -122.3, geometry: null, expires_at: '2026-09-12T10:00:00Z' });
    const poly = normalizeNwsAlert(
      { id: 'b', geometry: { type: 'Polygon', coordinates: [[[-122.5, 47.5], [-122, 47.5], [-122, 47.8], [-122.5, 47.5]]] }, properties: { id: 'urn:2', event: 'Flood Watch', status: 'Actual', expires: '2026-09-13T00:00:00Z' } },
      cell,
      now,
    );
    expect(poly?.geometry).toBe('SRID=4326;POLYGON((-122.5 47.5,-122 47.5,-122 47.8,-122.5 47.5))');
    expect(poly?.latitude).toBeNull();
  });
  it('drops test messages and cancellations', () => {
    expect(normalizeNwsAlert({ id: 'c', geometry: null, properties: { id: 'urn:3', event: 'Test', status: 'Test' } }, cell, now)).toBeNull();
    expect(normalizeNwsAlert({ id: 'd', geometry: null, properties: { id: 'urn:4', event: 'X', status: 'Actual', messageType: 'Cancel' } }, cell, now)).toBeNull();
  });
  it('converts MultiPolygon GeoJSON', () => {
    expect(geojsonToEwkt({ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] })).toBe('SRID=4326;MULTIPOLYGON(((0 0,1 0,1 1,0 0)),((2 2,3 2,3 3,2 2)))');
    expect(geojsonToEwkt({ type: 'LineString', coordinates: [] })).toBeNull();
  });
});

describe('NWS weather', () => {
  const period = (n: number, name: string, start: string, isDaytime: boolean, temp: number, short: string): NwsPeriod => ({
    number: n, name, startTime: start, endTime: start, isDaytime, temperature: temp, temperatureUnit: 'F', shortForecast: short, probabilityOfPrecipitation: { value: isDaytime ? 40 : null }, icon: null,
  });
  it('folds day/night periods into daily entries, handling a leading "Tonight"', () => {
    const daily = normalizeDaily([
      period(1, 'Tonight', '2026-09-11T18:00:00-07:00', false, 56, 'Cloudy'),
      period(2, 'Saturday', '2026-09-12T06:00:00-07:00', true, 70, 'Chance Rain'),
      period(3, 'Saturday Night', '2026-09-12T18:00:00-07:00', false, 54, 'Cloudy'),
      period(4, 'Sunday', '2026-09-13T06:00:00-07:00', true, 71, 'Sunny'),
    ]);
    expect(daily).toHaveLength(3);
    expect(daily[0]).toMatchObject({ name: 'Tonight', high_f: null, low_f: 56 });
    expect(daily[1]).toMatchObject({ name: 'Saturday', high_f: 70, low_f: 54, precip_pct: 40 });
    expect(daily[2]).toMatchObject({ name: 'Sunday', high_f: 71, low_f: null });
  });
  it('builds current conditions from an observation, converting units', () => {
    const hourly = normalizeHourly([period(1, '', '2026-09-11T18:00:00-07:00', false, 68, 'Mostly Cloudy')]);
    const current = normalizeCurrent({ timestamp: '2026-09-12T02:00:00+00:00', textDescription: 'Clear', temperature: { value: 19 }, relativeHumidity: { value: 45.6 }, windSpeed: { value: 10 } }, 'KBFI', hourly);
    expect(current).toMatchObject({ temp_f: 66, conditions: 'Clear', humidity_pct: 46, wind_mph: 6, station: 'KBFI', basis: 'observation' });
    expect(normalizeCurrent(null, null, hourly)).toMatchObject({ temp_f: 68, conditions: 'Mostly Cloudy', basis: 'forecast' });
  });
});

describe('AirNow', () => {
  const cell = { key: '47.6,-122.3', latitude: 47.6, longitude: -122.3 };
  const obs = (name: string, aqi: number, catName: string) => ({ DateObserved: '2026-09-11 ', HourObserved: 18, LocalTimeZone: 'PST', ReportingArea: 'Seattle', StateCode: 'WA', Latitude: 47.61, Longitude: -122.33, ParameterName: name, AQI: aqi, Category: { Number: 1, Name: catName } });
  it('takes the maximum pollutant AQI as the overall reading', () => {
    const row = normalizeAirNow([obs('O3', 38, 'Good'), obs('PM2.5', 142, 'Unhealthy for Sensitive Groups')], cell, now);
    expect(row).toMatchObject({ source: 'airnow', event_type: 'aqi_reading', aqi: 142, external_id: 'airnow:47.6,-122.3', severity: 'Unhealthy for Sensitive Groups' });
    expect((row?.attributes as Record<string, unknown>).pollutant).toBe('PM2.5');
    expect(row?.occurred_at).toBe('2026-09-12T02:00:00.000Z');
  });
  it('returns null with no valid observations', () => {
    expect(normalizeAirNow([], cell, now)).toBeNull();
    expect(observedAt({ ...obs('O3', 1, 'Good'), DateObserved: '' })).toBeNull();
  });
});

describe('NIFC / InciWeb', () => {
  it('normalizes a WFIGS feature', () => {
    const row = normalizeNifc(
      { geometry: { type: 'Point', coordinates: [-121.26, 47.41] }, properties: { IncidentName: 'Three Queens', PercentContained: 40, IncidentSize: 1200, IncidentTypeCategory: 'WF', FireDiscoveryDateTime: Date.parse('2026-09-01T00:00:00Z'), ModifiedOnDateTime_dt: Date.parse('2026-09-11T00:00:00Z'), IrwinID: '{ABC}', POOState: 'US-WA' } },
      now,
    );
    expect(row).toMatchObject({ source: 'inciweb', event_type: 'fire_incident', title: 'Three Queens Fire', external_id: 'nifc:{ABC}', latitude: 47.41, longitude: -121.26 });
    expect(row?.attributes).toMatchObject({ containment_pct: 40, acres: 1200, status: 'Active' });
  });
  it('parses DMS coordinates out of an InciWeb RSS description', () => {
    const description = 'Last updated: 2026-09-11\n\n--- \n\nThe type of incident is Wildfire and involves the following unit(s) Okanogan-Wenatchee National Forest. \n\n--- \n\nState: Washington\n\n--- \n\nCoordinates:\n\nLatitude: 47° 24 50  Longitude: 121° 15 41 \n\n--- \n\nNOTE: All fire perimeters and points are approximations.';
    const parsed = parseInciwebDescription(description);
    expect(parsed?.latitude).toBeCloseTo(47.4139, 3);
    expect(parsed?.longitude).toBeCloseTo(-121.2614, 3);
    expect(parsed?.state).toBe('Washington');
    expect(parsed?.updated).toBe('2026-09-11');
    const row = normalizeInciwebItem({ title: 'WAOWF Three Queens', link: 'http://inciweb.wildfire.gov/incident-information/waowf-three-queens', description }, now);
    expect(row).toMatchObject({ title: 'Three Queens Fire', external_id: 'inciweb:http://inciweb.wildfire.gov/incident-information/waowf-three-queens' });
    expect((row?.attributes as Record<string, unknown>).url).toContain('inciweb');
  });
});
