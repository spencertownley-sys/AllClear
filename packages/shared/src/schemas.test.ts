import { describe, expect, it } from 'vitest';
import {
  createLocationSchema,
  createRuleSchema,
  layersPutSchema,
  mapQuerySchema,
  pushSubscriptionSchema,
  validateRuleUpdate,
} from './schemas';

describe('createLocationSchema', () => {
  it('accepts a valid location', () => {
    const result = createLocationSchema.safeParse({ label: 'Home', latitude: 47.6, longitude: -122.3 });
    expect(result.success).toBe(true);
  });
  it('rejects out-of-range coordinates', () => {
    const result = createLocationSchema.safeParse({ label: 'Home', latitude: 95, longitude: -122.3 });
    expect(result.success).toBe(false);
  });
  it('rejects an empty label', () => {
    expect(createLocationSchema.safeParse({ label: '  ', latitude: 1, longitude: 1 }).success).toBe(false);
  });
});

describe('layersPutSchema', () => {
  it('rejects duplicate layer types', () => {
    const result = layersPutSchema.safeParse([
      { layer_type: 'wildfire', enabled: true, radius_miles: 25 },
      { layer_type: 'wildfire', enabled: false, radius_miles: 25 },
    ]);
    expect(result.success).toBe(false);
  });
  it('rejects a radius above 500 miles', () => {
    expect(layersPutSchema.safeParse([{ layer_type: 'wildfire', enabled: true, radius_miles: 900 }]).success).toBe(false);
  });
});

describe('createRuleSchema', () => {
  it('rejects invalid layer/condition combinations', () => {
    const result = createRuleSchema.safeParse({ layer_type: 'wildfire', condition_type: 'magnitude_threshold', threshold_value: 4 });
    expect(result.success).toBe(false);
  });
  it('requires a threshold for threshold-based conditions', () => {
    expect(createRuleSchema.safeParse({ layer_type: 'earthquake', condition_type: 'magnitude_threshold' }).success).toBe(false);
  });
  it('accepts any_active without a threshold and applies defaults', () => {
    const result = createRuleSchema.safeParse({ layer_type: 'official_alerts', condition_type: 'any_active' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe('both');
      expect(result.data.enabled).toBe(true);
    }
  });
  it('bounds AQI thresholds', () => {
    expect(createRuleSchema.safeParse({ layer_type: 'air_quality', condition_type: 'aqi_threshold', threshold_value: 900 }).success).toBe(false);
  });
});

describe('validateRuleUpdate', () => {
  it('validates a new threshold against the existing condition', () => {
    expect(validateRuleUpdate({ layer_type: 'earthquake', condition_type: 'magnitude_threshold' }, { threshold_value: 11 }).ok).toBe(false);
    expect(validateRuleUpdate({ layer_type: 'earthquake', condition_type: 'magnitude_threshold' }, { threshold_value: 5 }).ok).toBe(true);
    expect(validateRuleUpdate({ layer_type: 'earthquake', condition_type: 'magnitude_threshold' }, { enabled: false }).ok).toBe(true);
  });
});

describe('mapQuerySchema', () => {
  it('parses bbox and layers', () => {
    const result = mapQuerySchema.safeParse({ bbox: '-125,24,-66,50', layers: 'fires' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bbox.minLng).toBe(-125);
      expect(result.data.layers).toEqual({ fires: true, quakes: false, perimeters: false, storms: false });
    }
  });
  it('defaults to every layer', () => {
    const result = mapQuerySchema.safeParse({ bbox: '-125,24,-66,50' });
    expect(result.success && result.data.layers).toEqual({ fires: true, quakes: true, perimeters: true, storms: true });
  });
  it('rejects a bad bbox', () => {
    expect(mapQuerySchema.safeParse({ bbox: 'nope' }).success).toBe(false);
  });
});

describe('pushSubscriptionSchema', () => {
  it('requires an https endpoint and keys', () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'https://push.example/abc', keys: { p256dh: 'a', auth: 'b' } }).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'not a url', keys: { p256dh: 'a', auth: 'b' } }).success).toBe(false);
  });
});
