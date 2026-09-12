import { describe, expect, it } from 'vitest';
import { bboxAround, cellCenter, cellKey, haversineMiles, mergeBboxes, parseBbox, parseDms } from './geo';

const seattle = { latitude: 47.6062, longitude: -122.3321 };
const denver = { latitude: 39.7392, longitude: -104.9903 };

describe('haversineMiles', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMiles(seattle, seattle)).toBe(0);
  });
  it('matches the known Seattle–Denver distance (~1,020 mi)', () => {
    const d = haversineMiles(seattle, denver);
    expect(d).toBeGreaterThan(1010);
    expect(d).toBeLessThan(1030);
  });
  it('is symmetric', () => {
    expect(haversineMiles(seattle, denver)).toBeCloseTo(haversineMiles(denver, seattle), 6);
  });
});

describe('cellCenter / cellKey', () => {
  it('snaps to the nearest 0.1° cell', () => {
    expect(cellCenter(seattle, 0.1)).toEqual({ latitude: 47.6, longitude: -122.3 });
    expect(cellKey(seattle, 0.1)).toBe('47.6,-122.3');
  });
  it('snaps to the nearest 0.05° cell', () => {
    expect(cellCenter({ latitude: 47.6062, longitude: -122.3321 }, 0.05)).toEqual({
      latitude: 47.6,
      longitude: -122.35,
    });
  });
  it('produces the same key for two nearby points', () => {
    expect(cellKey({ latitude: 47.61, longitude: -122.33 }, 0.1)).toBe(cellKey(seattle, 0.1));
  });
});

describe('bboxAround', () => {
  it('contains the centre and is roughly symmetric', () => {
    const box = bboxAround(seattle, 25);
    expect(box.minLat).toBeLessThan(seattle.latitude);
    expect(box.maxLat).toBeGreaterThan(seattle.latitude);
    expect(box.minLng).toBeLessThan(seattle.longitude);
    expect(box.maxLng).toBeGreaterThan(seattle.longitude);
    // 25 miles ≈ 0.36° of latitude
    expect(box.maxLat - box.minLat).toBeCloseTo(0.72, 1);
  });
});

describe('parseBbox', () => {
  it('parses a valid bbox', () => {
    expect(parseBbox('-125,24,-66,50')).toEqual({ minLng: -125, minLat: 24, maxLng: -66, maxLat: 50 });
  });
  it('rejects malformed and out-of-range input', () => {
    expect(parseBbox('a,b,c,d')).toBeNull();
    expect(parseBbox('-125,24,-66')).toBeNull();
    expect(parseBbox('-125,95,-66,50')).toBeNull();
    expect(parseBbox('-66,24,-125,50')).toBeNull();
  });
});

describe('mergeBboxes', () => {
  it('merges overlapping boxes and keeps disjoint ones', () => {
    const merged = mergeBboxes([
      { minLng: 0, minLat: 0, maxLng: 2, maxLat: 2 },
      { minLng: 1, minLat: 1, maxLng: 3, maxLat: 3 },
      { minLng: 10, minLat: 10, maxLng: 11, maxLat: 11 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual({ minLng: 0, minLat: 0, maxLng: 3, maxLat: 3 });
  });
});

describe('parseDms', () => {
  it('parses InciWeb-style "47° 24 50"', () => {
    expect(parseDms('47° 24 50')).toBeCloseTo(47.4139, 3);
  });
  it('handles plain decimals and negatives', () => {
    expect(parseDms('-121.5')).toBeCloseTo(-121.5, 6);
    expect(parseDms('')).toBeNull();
  });
});
