import { describe, expect, it } from 'vitest';
import { alertCategory } from './alerts';

describe('alertCategory', () => {
  it('maps common NWS event names', () => {
    expect(alertCategory('Flash Flood Warning')).toBe('flood');
    expect(alertCategory('Red Flag Warning')).toBe('fire');
    expect(alertCategory('Fire Weather Watch')).toBe('fire');
    expect(alertCategory('High Wind Warning')).toBe('wind');
    expect(alertCategory('Severe Thunderstorm Watch')).toBe('storm');
    expect(alertCategory('Tornado Warning')).toBe('storm');
    expect(alertCategory('Winter Storm Warning')).toBe('winter');
    expect(alertCategory('Excessive Heat Warning')).toBe('heat');
    expect(alertCategory('Hurricane Warning')).toBe('tropical');
    expect(alertCategory('Small Craft Advisory')).toBe('marine');
    expect(alertCategory('Air Quality Alert')).toBe('air');
    expect(alertCategory('Special Weather Statement')).toBe('other');
  });
  it('prefers the more specific category when words overlap', () => {
    expect(alertCategory('Freezing Fog Advisory')).toBe('winter');
    expect(alertCategory('Coastal Flood Advisory')).toBe('flood');
    expect(alertCategory('Tropical Storm Warning')).toBe('tropical');
  });
});
