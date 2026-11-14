import { describe, expect, it } from 'vitest';
import { mapLimitsFor, roundCoord } from './map-limits';

describe('mapLimitsFor', () => {
  it('sends less for a national view than for a zoomed-in one', () => {
    const national = mapLimitsFor({ minLng: -130, minLat: 20, maxLng: -60, maxLat: 55 });
    const regional = mapLimitsFor({ minLng: -125, minLat: 40, maxLng: -110, maxLat: 49 });
    const local = mapLimitsFor({ minLng: -122.8, minLat: 45.3, maxLng: -122.4, maxLat: 45.7 });
    expect(national).toEqual({ markers: 1000, polygons: 150 });
    expect(regional).toEqual({ markers: 1800, polygons: 300 });
    expect(local).toEqual({ markers: 2500, polygons: 400 });
  });
});

describe('roundCoord', () => {
  it('keeps four decimal places', () => {
    expect(roundCoord('45.123456')).toBe(45.1235);
    expect(roundCoord(-122.000049)).toBe(-122);
  });
});
