import { describe, expect, it } from 'vitest';
import { normalizeOpenMeteo, offsetString } from './open-meteo';
import { buildOutlook } from './cpc-outlook';

describe('open-meteo', () => {
  it('formats UTC offsets like NWS timestamps', () => {
    expect(offsetString(-25200)).toBe('-07:00');
    expect(offsetString(19800)).toBe('+05:30');
    expect(offsetString(0)).toBe('+00:00');
  });
  it('normalises hourly and daily rows with local-time ISO strings and WMO text', () => {
    const { hourly, daily } = normalizeOpenMeteo({
      latitude: 47.6,
      longitude: -122.3,
      utc_offset_seconds: -25200,
      timezone: 'America/Los_Angeles',
      hourly: {
        time: ['2026-09-26T14:00', '2026-09-26T15:00'],
        temperature_2m: [61.2, 62.7],
        relative_humidity_2m: [70, 66],
        precipitation_probability: [20, 35],
        precipitation: [0, 0.02],
        weather_code: [2, 61],
        wind_speed_10m: [8.4, 9.1],
        wind_direction_10m: [225, 230],
        wind_gusts_10m: [15.2, 17.9],
      },
      daily: {
        time: ['2026-09-26', '2026-09-27'],
        weather_code: [61, 3],
        temperature_2m_max: [63.1, 65.4],
        temperature_2m_min: [50.2, 51.0],
        precipitation_sum: [0.25, 0],
        precipitation_probability_max: [80, 10],
        wind_speed_10m_max: [14.3, 9.9],
        wind_gusts_10m_max: [28.1, 18.0],
        sunrise: ['2026-09-26T07:01', '2026-09-27T07:02'],
        sunset: ['2026-09-26T19:00', '2026-09-27T18:58'],
        uv_index_max: [2.4, 3.1],
      },
    });
    expect(hourly).toHaveLength(2);
    expect(hourly[0]).toMatchObject({ time: '2026-09-26T14:00:00-07:00', temp_f: 61.2, conditions: 'Partly cloudy', wind_dir: 'SW', humidity_pct: 70, source: 'open_meteo' });
    expect(hourly[1]?.conditions).toBe('Light rain');
    expect(daily[0]).toMatchObject({ date: '2026-09-26', name: 'Saturday', high_f: 63.1, low_f: 50.2, precip_pct: 80, precip_in: 0.25, conditions: 'Light rain', uv_max: 2.4, source: 'open_meteo' });
    expect(daily[0]?.sunrise).toBe('2026-09-26T07:01:00-07:00');
  });
});

describe('cpc outlook', () => {
  it('folds temperature and precipitation hits into dated periods', () => {
    const outlook = buildOutlook({
      '6-10:temperature': { fcst_date: 1790294400000, start_date: 1790812800000, end_date: 1791158400000, prob: 36, cat: 'Normal' },
      '6-10:precipitation': { fcst_date: 1790294400000, start_date: 1790812800000, end_date: 1791158400000, prob: 40, cat: 'Above' },
      '8-14:temperature': { fcst_date: 1790294400000, start_date: 1790985600000, end_date: 1791504000000, prob: 50, cat: 'Above' },
      '8-14:precipitation': null,
    });
    expect(outlook?.periods).toHaveLength(2);
    expect(outlook?.periods[0]).toMatchObject({ key: '6-10', start_date: '2026-10-01', end_date: '2026-10-05', temperature: { category: 'Normal', probability: 36 }, precipitation: { category: 'Above', probability: 40 } });
    expect(outlook?.periods[1]).toMatchObject({ key: '8-14', temperature: { category: 'Above', probability: 50 }, precipitation: null });
    expect(outlook?.issued_at).toBe('2026-09-25T00:00:00.000Z');
  });
  it('returns null when the point is outside every outlook polygon', () => {
    expect(buildOutlook({ '6-10:temperature': null, '6-10:precipitation': null, '8-14:temperature': null, '8-14:precipitation': null })).toBeNull();
  });
});
