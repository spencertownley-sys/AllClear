import { celsiusToFahrenheit, kmhToMph, type WeatherCurrent, type WeatherDaily, type WeatherHourly } from '@allclear/shared';
import { fetchJson } from '../http';
import { cellsFor, type Cell } from '../cells';
import { getWatchLocations, upsertWeather, type WeatherInsert } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

interface Quantity {
  value: number | null;
  unitCode?: string;
}

export interface NwsPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation?: Quantity;
  relativeHumidity?: Quantity;
  windSpeed?: string;
  windDirection?: string;
  icon?: string | null;
  shortForecast: string;
  detailedForecast?: string;
}

export interface NwsObservation {
  timestamp?: string;
  textDescription?: string | null;
  temperature?: Quantity;
  relativeHumidity?: Quantity;
  windSpeed?: Quantity;
  windDirection?: Quantity;
  windGust?: Quantity;
  icon?: string | null;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Degrees (direction the wind blows from) → 16-point compass label. */
export function degreesToCompass(deg: number | null | undefined): string | null {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? null;
}

/** NWS wind speed strings look like "2 mph" or "2 to 6 mph"; take the upper bound. */
export function parseWindMph(value: string | undefined): number | null {
  if (!value) return null;
  const nums = value.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : null;
}

interface PointsResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    timeZone?: string;
    relativeLocation?: { properties?: { city?: string; state?: string } };
  };
}

const WEATHER_TTL_MINUTES = 60;
const pointsCache = new Map<string, PointsResponse['properties']>();

function tempF(period: NwsPeriod): number | null {
  if (!Number.isFinite(period.temperature)) return null;
  return period.temperatureUnit === 'C' ? celsiusToFahrenheit(period.temperature) : period.temperature;
}

export function normalizeHourly(periods: NwsPeriod[]): WeatherHourly[] {
  return periods.slice(0, 24).map((p) => ({
    time: p.startTime,
    temp_f: tempF(p),
    conditions: p.shortForecast,
    precip_pct: p.probabilityOfPrecipitation?.value ?? null,
    icon: p.icon ?? null,
    wind_mph: parseWindMph(p.windSpeed),
    wind_dir: p.windDirection ?? null,
  }));
}

/** NWS returns alternating day/night periods; fold them into one entry per calendar day. */
export function normalizeDaily(periods: NwsPeriod[]): WeatherDaily[] {
  const days: WeatherDaily[] = [];
  for (const p of periods) {
    const date = p.startTime.slice(0, 10);
    const last = days[days.length - 1];
    if (p.isDaytime) {
      days.push({
        date,
        name: p.name,
        high_f: tempF(p),
        low_f: null,
        conditions: p.shortForecast,
        precip_pct: p.probabilityOfPrecipitation?.value ?? null,
        icon: p.icon ?? null,
        detailed: p.detailedForecast ?? null,
      });
    } else if (last && last.low_f === null && last.high_f !== null) {
      last.low_f = tempF(p);
      if (last.precip_pct === null) last.precip_pct = p.probabilityOfPrecipitation?.value ?? null;
    } else {
      // Leading night period ("Tonight"): a day with only a low.
      days.push({
        date,
        name: p.name,
        high_f: null,
        low_f: tempF(p),
        conditions: p.shortForecast,
        precip_pct: p.probabilityOfPrecipitation?.value ?? null,
        icon: p.icon ?? null,
        detailed: p.detailedForecast ?? null,
      });
    }
  }
  return days.slice(0, 7);
}

export function normalizeCurrent(obs: NwsObservation | null, station: string | null, hourly: WeatherHourly[]): WeatherCurrent | null {
  const tempC = obs?.temperature?.value;
  if (obs && typeof tempC === 'number' && Number.isFinite(tempC)) {
    return {
      temp_f: celsiusToFahrenheit(tempC),
      conditions: obs.textDescription?.trim() || hourly[0]?.conditions || 'Conditions unavailable',
      humidity_pct: typeof obs.relativeHumidity?.value === 'number' ? Math.round(obs.relativeHumidity.value) : null,
      wind_mph: typeof obs.windSpeed?.value === 'number' ? kmhToMph(obs.windSpeed.value) : null,
      wind_dir: degreesToCompass(obs.windDirection?.value) ?? hourly[0]?.wind_dir ?? null,
      wind_gust_mph: typeof obs.windGust?.value === 'number' ? kmhToMph(obs.windGust.value) : null,
      icon: obs.icon ?? null,
      observed_at: obs.timestamp ?? null,
      station,
      basis: 'observation',
    };
  }
  const first = hourly[0];
  if (!first) return null;
  return {
    temp_f: first.temp_f,
    conditions: first.conditions,
    humidity_pct: null,
    wind_mph: first.wind_mph,
    wind_dir: first.wind_dir,
    wind_gust_mph: null,
    icon: first.icon,
    observed_at: first.time,
    station: null,
    basis: 'forecast',
  };
}

async function pointsFor(cell: Cell, headers: Record<string, string>): Promise<PointsResponse['properties']> {
  const cached = pointsCache.get(cell.key);
  if (cached) return cached;
  const res = await fetchJson<PointsResponse>(`https://api.weather.gov/points/${cell.latitude},${cell.longitude}`, { headers });
  pointsCache.set(cell.key, res.properties);
  return res.properties;
}

export const nwsWeatherPoller: Poller = {
  name: 'nws_weather',
  layers: ['weather'],
  intervalMinutes: (c) => c.POLL_NWS_WEATHER_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const cells = cellsFor(locations, 'weather', 'weather').slice(0, config.MAX_CELLS_PER_RUN);
    const headers = { 'User-Agent': config.NWS_USER_AGENT, Accept: 'application/geo+json' };
    const rows: WeatherInsert[] = [];
    let failedCells = 0;
    for (const cell of cells) {
      try {
        const points = await pointsFor(cell, headers);
        const [forecast, hourly] = await Promise.all([
          fetchJson<{ properties: { periods: NwsPeriod[] } }>(points.forecast, { headers }),
          fetchJson<{ properties: { periods: NwsPeriod[] } }>(points.forecastHourly, { headers }),
        ]);
        let observation: NwsObservation | null = null;
        let station: string | null = null;
        try {
          const stations = await fetchJson<{ features: Array<{ properties: { stationIdentifier: string } }> }>(points.observationStations, { headers, retries: 0 });
          station = stations.features?.[0]?.properties.stationIdentifier ?? null;
          if (station) {
            const latest = await fetchJson<{ properties: NwsObservation }>(`https://api.weather.gov/stations/${station}/observations/latest`, { headers, retries: 0 });
            observation = latest.properties;
          }
        } catch (error) {
          log.debug('nws observation unavailable; using hourly forecast', { cell: cell.key, ...errorFields(error) });
        }
        const hourlyRows = normalizeHourly(hourly.properties.periods ?? []);
        rows.push({
          grid_key: cell.key,
          latitude: cell.latitude,
          longitude: cell.longitude,
          city_name: points.relativeLocation?.properties?.city ?? null,
          state: points.relativeLocation?.properties?.state ?? null,
          time_zone: points.timeZone ?? null,
          current: normalizeCurrent(observation, station, hourlyRows),
          hourly: hourlyRows,
          daily: normalizeDaily(forecast.properties.periods ?? []),
          source: 'nws',
          fetched_at: now.toISOString(),
          expires_at: new Date(now.getTime() + WEATHER_TTL_MINUTES * 60_000).toISOString(),
        });
      } catch (error) {
        failedCells += 1;
        pointsCache.delete(cell.key);
        log.warn('nws weather cell failed', { cell: cell.key, ...errorFields(error) });
      }
    }
    if (cells.length > 0 && rows.length === 0) throw new Error('Every NWS weather cell failed');
    const written = await upsertWeather(sb, rows);
    return { rows: written, details: { cells: cells.length, failedCells } };
  },
};
