import { describe, expect, it } from 'vitest';
import { nationalWhere, normalizeHistory, plausibleYear } from './nifc-history';

const now = new Date('2026-09-26T00:00:00Z');

describe('nifc history', () => {
  it('builds the nationwide filter for large fires only, bounded to real years', () => {
    expect(nationalWhere(2001, now)).toBe('FIRE_YEAR_INT >= 2001 AND FIRE_YEAR_INT <= 2027 AND GIS_ACRES >= 1000');
    expect(nationalWhere(2016, now, 5000)).toBe('FIRE_YEAR_INT >= 2016 AND FIRE_YEAR_INT <= 2027 AND GIS_ACRES >= 5000');
  });
  it("treats NIFC's 9999 placeholder (and other nonsense) as unknown year", () => {
    expect(plausibleYear(9999, now)).toBeNull();
    expect(plausibleYear(0, now)).toBeNull();
    expect(plausibleYear(2018, now)).toBe(2018);
    expect(plausibleYear('2018', now)).toBeNull();
    const row = normalizeHistory(
      { geometry: { type: 'Polygon', coordinates: [[[-121, 39], [-120.9, 39], [-120.9, 39.1], [-121, 39]]] }, properties: { OBJECTID: 8, INCIDENT: 'Mystery', FIRE_YEAR_INT: 9999, GIS_ACRES: 2000 } },
      now,
    );
    expect(row?.attributes).toMatchObject({ year: null });
    expect(row?.occurred_at).toBeNull();
  });
  it('keeps the fire year so the read side can filter by look-back', () => {
    const row = normalizeHistory(
      {
        geometry: { type: 'Polygon', coordinates: [[[-121, 39], [-120.9, 39], [-120.9, 39.1], [-121, 39]]] },
        properties: { OBJECTID: 7, INCIDENT: 'Camp', FIRE_YEAR_INT: 2018, GIS_ACRES: 153336.2 },
      },
      now,
    );
    expect(row?.event_type).toBe('fire_perimeter_historical');
    expect(row?.attributes).toMatchObject({ year: 2018, acres: 153336 });
    expect(row?.title).toBe('Camp Fire');
  });
});
