import { describe, expect, it } from 'vitest';
import { mergeDaily, mergeHourly, weeklySummaries } from './weather-merge';

const h = (time: string, source: 'nws' | 'open_meteo') => ({ time, temp_f: 60, conditions: 'Clear', precip_pct: 0, icon: null, wind_mph: 5, wind_dir: 'N', source });
const d = (date: string, source: 'nws' | 'open_meteo', extra: Record<string, unknown> = {}) => ({ date, name: date, high_f: 70, low_f: 50, conditions: source === 'nws' ? 'Sunny' : 'Clear', precip_pct: 10, icon: null, detailed: null, source, ...extra });

describe('weather merge', () => {
  it('appends Open-Meteo hours only after the last NWS hour and drops the past', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    const merged = mergeHourly(
      [h('2026-09-26T10:00:00Z', 'nws'), h('2026-09-26T12:00:00Z', 'nws'), h('2026-09-26T13:00:00Z', 'nws')],
      [h('2026-09-26T12:00:00Z', 'open_meteo'), h('2026-09-26T13:00:00Z', 'open_meteo'), h('2026-09-26T14:00:00Z', 'open_meteo')],
      now,
    );
    expect(merged.map((x) => `${x.time}:${x.source}`)).toEqual([
      '2026-09-26T12:00:00Z:nws',
      '2026-09-26T13:00:00Z:nws',
      '2026-09-26T14:00:00Z:open_meteo',
    ]);
  });
  it('prefers NWS days, borrows model extras, and extends with Open-Meteo days', () => {
    const merged = mergeDaily(
      [d('2026-09-26', 'nws'), d('2026-09-27', 'nws')],
      [d('2026-09-26', 'open_meteo', { wind_mph: 12, precip_in: 0.3 }), d('2026-09-27', 'open_meteo'), d('2026-09-28', 'open_meteo')],
    );
    expect(merged.map((x) => x.source)).toEqual(['nws', 'nws', 'open_meteo']);
    expect(merged[0]).toMatchObject({ conditions: 'Sunny', wind_mph: 12, precip_in: 0.3 });
  });
  it('rolls days into weekly summaries', () => {
    const days = Array.from({ length: 16 }, (_, i) => d(`2026-10-${String(i + 1).padStart(2, '0')}`, 'open_meteo', { precip_in: 0.1, wind_gust_mph: 10 + i }));
    const weeks = weeklySummaries(days);
    expect(weeks.map((w) => [w.label, w.days])).toEqual([
      ['This week', 7],
      ['Next week', 7],
      ['Days 15–16', 2],
    ]);
    expect(weeks[0]).toMatchObject({ avg_high_f: 70, avg_low_f: 50, total_precip_in: 0.7, max_wind_mph: 16 });
  });
});
