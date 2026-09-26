import { FORECAST_DAYS, type WeatherDaily, type WeatherHourly, type WeeklySummary } from '@allclear/shared';

/** NWS hours first (official, richer text), then Open-Meteo hours after the last NWS hour. Drops hours already past. */
export function mergeHourly(nws: WeatherHourly[], extended: WeatherHourly[], now = new Date()): WeatherHourly[] {
  const cutoff = now.getTime() - 3_600_000;
  const keep = (h: WeatherHourly) => {
    const t = Date.parse(h.time);
    return Number.isNaN(t) || t >= cutoff;
  };
  const primary = nws.filter(keep);
  const lastNws = primary.length ? Date.parse(primary[primary.length - 1]!.time) : Number.NEGATIVE_INFINITY;
  const tail = extended.filter((h) => keep(h) && Date.parse(h.time) > lastNws);
  return [...primary, ...tail];
}

/** NWS days by date, then Open-Meteo days for dates NWS does not cover, capped at FORECAST_DAYS. */
export function mergeDaily(nws: WeatherDaily[], extended: WeatherDaily[], limit = FORECAST_DAYS): WeatherDaily[] {
  const byDate = new Map<string, WeatherDaily>();
  for (const d of extended) byDate.set(d.date, d);
  for (const d of nws) {
    const ext = byDate.get(d.date);
    // Keep NWS text and probabilities, but borrow the model's extras (wind, rain amount, sun times) when NWS lacks them.
    byDate.set(d.date, ext ? { ...ext, ...d, high_f: d.high_f ?? ext.high_f, low_f: d.low_f ?? ext.low_f, precip_pct: d.precip_pct ?? ext.precip_pct } : d);
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}
function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100 : null;
}
function max(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.max(...nums) : null;
}

/** Week 1 / week 2 / remainder roll-ups for the "by week" view; the most common conditions text wins. */
export function weeklySummaries(daily: WeatherDaily[]): WeeklySummary[] {
  const weeks: WeeklySummary[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;
    const counts = new Map<string, number>();
    for (const d of chunk) counts.set(d.conditions, (counts.get(d.conditions) ?? 0) + 1);
    const conditions = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const n = weeks.length + 1;
    weeks.push({
      label: chunk.length < 7 ? `Days ${i + 1}–${i + chunk.length}` : n === 1 ? 'This week' : n === 2 ? 'Next week' : `Week ${n}`,
      start_date: first.date,
      end_date: last.date,
      days: chunk.length,
      avg_high_f: avg(chunk.map((d) => d.high_f)),
      avg_low_f: avg(chunk.map((d) => d.low_f)),
      total_precip_in: sum(chunk.map((d) => d.precip_in)),
      max_precip_pct: max(chunk.map((d) => d.precip_pct)),
      max_wind_mph: max(chunk.map((d) => d.wind_gust_mph ?? d.wind_mph)),
      conditions,
    });
  }
  return weeks;
}
