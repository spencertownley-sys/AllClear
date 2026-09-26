import { describe, expect, it } from 'vitest';
import { normalizeDensity, normalizeSmoke, parseHmsTimestamp, type SmokeFeature } from './smoke';

describe('parseHmsTimestamp', () => {
  it('parses YYYYDDD HHMM UTC into an ISO timestamp', () => {
    // Day 268 of 2026 is September 25 (2026 is not a leap year).
    expect(parseHmsTimestamp('2026268 1200')).toBe('2026-09-25T12:00:00.000Z');
  });
  it('returns null for missing or malformed input', () => {
    expect(parseHmsTimestamp(null)).toBeNull();
    expect(parseHmsTimestamp(undefined)).toBeNull();
    expect(parseHmsTimestamp('garbage')).toBeNull();
  });
});

describe('normalizeDensity', () => {
  it('lowercases known values and defaults unknowns to light', () => {
    expect(normalizeDensity('Light')).toBe('light');
    expect(normalizeDensity('Medium')).toBe('medium');
    expect(normalizeDensity('Heavy')).toBe('heavy');
    expect(normalizeDensity(null)).toBe('light');
    expect(normalizeDensity('Unknown')).toBe('light');
  });
});

describe('normalizeSmoke', () => {
  const now = new Date('2026-09-26T00:00:00Z');
  const feature: SmokeFeature = {
    geometry: { type: 'Polygon', coordinates: [[[-90.5, 32.3], [-90.6, 32.4], [-90.4, 32.4], [-90.5, 32.3]]] },
    properties: { FID: 42, Satellite: 'GOES-WEST', Start: '2026268 1200', End_: '2026268 1500', Density: 'Heavy' },
  };

  it('normalizes a smoke polygon into an EventInsert', () => {
    const row = normalizeSmoke(feature, now);
    expect(row).not.toBeNull();
    expect(row?.source).toBe('nesdis');
    expect(row?.event_type).toBe('smoke_plume');
    expect(row?.external_id).toBe('hms-smoke:42');
    expect(row?.title).toBe('Heavy smoke');
    expect(row?.attributes).toMatchObject({ density: 'heavy', satellite: 'GOES-WEST' });
    expect(row?.occurred_at).toBe('2026-09-25T12:00:00.000Z');
  });

  it('skips features with no geometry or no FID', () => {
    expect(normalizeSmoke({ ...feature, geometry: null }, now)).toBeNull();
    expect(normalizeSmoke({ ...feature, properties: { ...feature.properties, FID: null } }, now)).toBeNull();
  });
});
