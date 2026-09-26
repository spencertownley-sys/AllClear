import { describe, expect, it } from 'vitest';
import { nationalWhere, normalizeHistory } from './nifc-history';

describe('nifc history', () => {
  it('builds the nationwide filter for large fires only', () => {
    expect(nationalWhere(2001)).toBe('FIRE_YEAR_INT >= 2001 AND GIS_ACRES >= 1000');
    expect(nationalWhere(2016, 5000)).toBe('FIRE_YEAR_INT >= 2016 AND GIS_ACRES >= 5000');
  });
  it('keeps the fire year so the read side can filter by look-back', () => {
    const row = normalizeHistory(
      {
        geometry: { type: 'Polygon', coordinates: [[[-121, 39], [-120.9, 39], [-120.9, 39.1], [-121, 39]]] },
        properties: { OBJECTID: 7, INCIDENT: 'Camp', FIRE_YEAR_INT: 2018, GIS_ACRES: 153336.2 },
      },
      new Date('2026-09-26T00:00:00Z'),
    );
    expect(row?.event_type).toBe('fire_perimeter_historical');
    expect(row?.attributes).toMatchObject({ year: 2018, acres: 153336 });
    expect(row?.title).toBe('Camp Fire');
  });
});
