import { aqiCategory, type Json } from '@allclear/shared';
import { fetchJson } from '../http';
import { cellsFor, type Cell } from '../cells';
import { getWatchLocations, upsertEvents, type EventInsert } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

export interface AirNowObservation {
  DateObserved: string;
  HourObserved: number;
  LocalTimeZone: string;
  ReportingArea: string;
  StateCode: string;
  Latitude: number;
  Longitude: number;
  ParameterName: string;
  AQI: number;
  Category: { Number: number; Name: string };
}

const AQI_TTL_HOURS = 3;

const TZ_OFFSETS: Record<string, string> = {
  EST: '-05:00', EDT: '-04:00', CST: '-06:00', CDT: '-05:00', MST: '-07:00', MDT: '-06:00',
  PST: '-08:00', PDT: '-07:00', AKST: '-09:00', AKDT: '-08:00', HST: '-10:00', AST: '-04:00',
};

export function observedAt(obs: AirNowObservation): string | null {
  const date = obs.DateObserved?.trim();
  if (!date) return null;
  const hh = String(obs.HourObserved ?? 0).padStart(2, '0');
  const offset = TZ_OFFSETS[obs.LocalTimeZone] ?? 'Z';
  const d = new Date(`${date}T${hh}:00:00${offset}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** AirNow reports one row per pollutant; the overall AQI is the maximum. */
export function normalizeAirNow(observations: AirNowObservation[], cell: Cell, now: Date): EventInsert | null {
  const valid = observations.filter((o) => Number.isFinite(o.AQI) && o.AQI >= 0);
  if (valid.length === 0) return null;
  const top = valid.reduce((a, b) => (b.AQI > a.AQI ? b : a));
  const category = top.Category?.Name ?? aqiCategory(top.AQI).name;
  return {
    source: 'airnow',
    external_id: `airnow:${cell.key}`,
    event_type: 'aqi_reading',
    title: `AQI ${top.AQI} (${category})`,
    severity: category,
    latitude: Number.isFinite(top.Latitude) ? top.Latitude : cell.latitude,
    longitude: Number.isFinite(top.Longitude) ? top.Longitude : cell.longitude,
    aqi: Math.round(top.AQI),
    occurred_at: observedAt(top),
    attributes: {
      pollutant: top.ParameterName ?? null,
      reporting_area: top.ReportingArea ?? null,
      state: top.StateCode ?? null,
      category,
      readings: valid.map((o) => ({ pollutant: o.ParameterName, aqi: o.AQI })),
    },
    raw_payload: valid as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + AQI_TTL_HOURS * 3_600_000).toISOString(),
  };
}

export const airnowPoller: Poller = {
  name: 'airnow',
  layers: ['air_quality'],
  intervalMinutes: (c) => c.POLL_AIRNOW_MINUTES,
  disabledReason: (c) => (c.AIRNOW_API_KEY ? null : 'AIRNOW_API_KEY is not set'),
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const allCells = cellsFor(locations, 'aqi', 'air_quality');
    const cells = allCells.slice(0, config.MAX_CELLS_PER_RUN);
    if (allCells.length > cells.length) log.warn('airnow: cell cap reached', { total: allCells.length, cap: config.MAX_CELLS_PER_RUN });
    const rows: EventInsert[] = [];
    let failedCells = 0;
    let emptyCells = 0;
    for (const cell of cells) {
      try {
        const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${cell.latitude}&longitude=${cell.longitude}&distance=25&API_KEY=${config.AIRNOW_API_KEY}`;
        const observations = await fetchJson<AirNowObservation[]>(url);
        const row = normalizeAirNow(Array.isArray(observations) ? observations : [], cell, now);
        if (row) rows.push(row);
        else emptyCells += 1;
      } catch (error) {
        failedCells += 1;
        log.warn('airnow cell failed', { cell: cell.key, ...errorFields(error) });
      }
    }
    if (cells.length > 0 && failedCells === cells.length) throw new Error('Every AirNow cell failed');
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { cells: cells.length, failedCells, emptyCells } };
  },
};
