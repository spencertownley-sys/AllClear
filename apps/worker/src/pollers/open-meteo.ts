import { FORECAST_DAYS, wmoDescription, type WeatherDaily, type WeatherHourly } from '@allclear/shared';
import { fetchJson } from '../http';
import { cellsFor, type Cell } from '../cells';
import { getWatchLocations, upsertWeather, type WeatherInsert } from '../db';
import { log, errorFields } from '../logger';
import { degreesToCompass } from './nws-weather';
import type { Poller, PollerContext } from './types';

/**
 * Open-Meteo: free, key-less 16-day model forecast (non-commercial use, attribution required).
 * NWS stays the source for days 1–7 and current conditions; this fills days 8–16 and the
 * hour-by-hour view beyond what NWS publishes.
 */
const BASE = 'https://api.open-meteo.com/v1/forecast';
const BATCH = 20;
const TTL_HOURS = 6;
const HOURLY = 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max';

export interface OpenMeteoResult {
  latitude: number;
  longitude: number;
  utc_offset_seconds: number;
  timezone?: string;
  hourly: {
    time: string[];
    temperature_2m: Array<number | null>;
    relative_humidity_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    precipitation?: Array<number | null>;
    weather_code?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_direction_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
  daily: {
    time: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
    wind_gusts_10m_max?: Array<number | null>;
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: Array<number | null>;
  };
}

/** "-25200" → "-07:00" so local times become unambiguous ISO strings like NWS's. */
export function offsetString(utcOffsetSeconds: number): string {
  const sign = utcOffsetSeconds < 0 ? '-' : '+';
  const abs = Math.abs(utcOffsetSeconds);
  const h = String(Math.floor(abs / 3600)).padStart(2, '0');
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${sign}${h}:${m}`;
}

const num = (arr: Array<number | null> | undefined, i: number): number | null => {
  const v = arr?.[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const round1 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);

function weekdayName(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function normalizeOpenMeteo(result: OpenMeteoResult): { hourly: WeatherHourly[]; daily: WeatherDaily[] } {
  const tz = offsetString(result.utc_offset_seconds ?? 0);
  const h = result.hourly;
  const hourly: WeatherHourly[] = (h?.time ?? []).map((t, i) => ({
    time: `${t}:00${tz}`,
    temp_f: round1(num(h.temperature_2m, i)),
    conditions: wmoDescription(num(h.weather_code, i)),
    precip_pct: num(h.precipitation_probability, i),
    precip_in: num(h.precipitation, i),
    icon: null,
    wind_mph: round1(num(h.wind_speed_10m, i)),
    wind_dir: degreesToCompass(num(h.wind_direction_10m, i)),
    wind_gust_mph: round1(num(h.wind_gusts_10m, i)),
    humidity_pct: num(h.relative_humidity_2m, i),
    source: 'open_meteo',
  }));
  const d = result.daily;
  const daily: WeatherDaily[] = (d?.time ?? []).map((date, i) => ({
    date,
    name: weekdayName(date),
    high_f: round1(num(d.temperature_2m_max, i)),
    low_f: round1(num(d.temperature_2m_min, i)),
    conditions: wmoDescription(num(d.weather_code, i)),
    precip_pct: num(d.precipitation_probability_max, i),
    precip_in: num(d.precipitation_sum, i),
    icon: null,
    detailed: null,
    wind_mph: round1(num(d.wind_speed_10m_max, i)),
    wind_gust_mph: round1(num(d.wind_gusts_10m_max, i)),
    sunrise: d.sunrise?.[i] ? `${d.sunrise[i]}:00${tz}` : null,
    sunset: d.sunset?.[i] ? `${d.sunset[i]}:00${tz}` : null,
    uv_max: round1(num(d.uv_index_max, i)),
    source: 'open_meteo',
  }));
  return { hourly, daily };
}

async function fetchBatch(cells: Cell[]): Promise<OpenMeteoResult[]> {
  const url = new URL(BASE);
  url.searchParams.set('latitude', cells.map((c) => c.latitude.toFixed(4)).join(','));
  url.searchParams.set('longitude', cells.map((c) => c.longitude.toFixed(4)).join(','));
  url.searchParams.set('hourly', HOURLY);
  url.searchParams.set('daily', DAILY);
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
  const data = await fetchJson<OpenMeteoResult | OpenMeteoResult[]>(url.toString(), { timeoutMs: 60_000 });
  return Array.isArray(data) ? data : [data];
}

export const openMeteoPoller: Poller = {
  name: 'open_meteo',
  layers: ['weather'],
  intervalMinutes: (c) => c.POLL_OPEN_METEO_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const cells = cellsFor(locations, 'weather', 'weather').slice(0, config.MAX_CELLS_PER_RUN);
    const rows: WeatherInsert[] = [];
    let failedBatches = 0;
    let batches = 0;
    for (let i = 0; i < cells.length; i += BATCH) {
      const batch = cells.slice(i, i + BATCH);
      batches += 1;
      try {
        const results = await fetchBatch(batch);
        if (results.length !== batch.length) throw new Error(`Open-Meteo returned ${results.length} results for ${batch.length} points`);
        results.forEach((result, j) => {
          const cell = batch[j]!;
          const { hourly, daily } = normalizeOpenMeteo(result);
          rows.push({
            grid_key: cell.key,
            latitude: cell.latitude,
            longitude: cell.longitude,
            time_zone: result.timezone ?? null,
            extended_hourly: hourly,
            extended_daily: daily,
            extended_fetched_at: now.toISOString(),
          });
        });
      } catch (error) {
        failedBatches += 1;
        log.warn('open-meteo batch failed', { cells: batch.map((c) => c.key), ...errorFields(error) });
      }
    }
    if (cells.length > 0 && rows.length === 0) throw new Error('Every Open-Meteo batch failed');
    const written = await upsertWeather(sb, rows);
    return { rows: written, details: { cells: cells.length, batches, failedBatches, ttlHours: TTL_HOURS } };
  },
};
