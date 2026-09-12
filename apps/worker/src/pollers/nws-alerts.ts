import { fetchJson } from '../http';
import { geojsonToEwkt } from '../geojson';
import { cellsFor, type Cell } from '../cells';
import { expireMissingAlerts, getWatchLocations, upsertEvents, type EventInsert } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

export interface NwsAlertFeature {
  id: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    id: string;
    event: string;
    headline?: string | null;
    description?: string | null;
    instruction?: string | null;
    severity?: string;
    urgency?: string;
    certainty?: string;
    senderName?: string;
    areaDesc?: string;
    sent?: string;
    effective?: string;
    onset?: string | null;
    expires?: string | null;
    ends?: string | null;
    status?: string;
    messageType?: string;
    category?: string;
    response?: string;
  };
}

export function normalizeNwsAlert(feature: NwsAlertFeature, cell: Cell, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!p?.event || !p.id) return null;
  // Only real, current alerts — skip tests/exercises and cancellations.
  if (p.status && p.status !== 'Actual') return null;
  if (p.messageType === 'Cancel') return null;
  const geometry = geojsonToEwkt(feature.geometry as Parameters<typeof geojsonToEwkt>[0]);
  const expires = p.ends ?? p.expires ?? null;
  return {
    source: 'nws',
    external_id: p.id,
    event_type: 'severe_alert',
    title: p.event,
    description: p.description ?? null,
    severity: p.severity ?? 'Unknown',
    // Zone-based alerts have no polygon; we record the polled cell so alerts_for_point can
    // still match them by proximity. Polygon alerts match by intersection.
    latitude: geometry ? null : cell.latitude,
    longitude: geometry ? null : cell.longitude,
    geometry,
    occurred_at: p.onset ?? p.effective ?? p.sent ?? null,
    attributes: {
      headline: p.headline ?? null,
      instruction: p.instruction ?? null,
      urgency: p.urgency ?? null,
      certainty: p.certainty ?? null,
      sender: p.senderName ?? null,
      area: p.areaDesc ?? null,
      message_type: p.messageType ?? null,
      category: p.category ?? null,
      response: p.response ?? null,
      sent: p.sent ?? null,
    },
    raw_payload: {
      id: p.id,
      event: p.event,
      headline: p.headline ?? null,
      severity: p.severity ?? null,
      sent: p.sent ?? null,
      expires: p.expires ?? null,
      ends: p.ends ?? null,
      areaDesc: p.areaDesc ?? null,
    },
    fetched_at: now.toISOString(),
    expires_at: expires,
  };
}

export const nwsAlertsPoller: Poller = {
  name: 'nws_alerts',
  layers: ['official_alerts', 'weather'],
  intervalMinutes: (c) => c.POLL_NWS_ALERTS_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const locations = await getWatchLocations(sb);
    const cells = cellsFor(locations, 'alerts', null).slice(0, config.MAX_CELLS_PER_RUN);
    const headers = { 'User-Agent': config.NWS_USER_AGENT, Accept: 'application/geo+json' };
    const rows: EventInsert[] = [];
    let polledCells = 0;
    let failedCells = 0;
    let expired = 0;
    for (const cell of cells) {
      try {
        const url = `https://api.weather.gov/alerts/active?point=${cell.latitude},${cell.longitude}`;
        const feed = await fetchJson<{ features: NwsAlertFeature[] }>(url, { headers });
        const active = new Set<string>();
        for (const feature of feed.features ?? []) {
          const row = normalizeNwsAlert(feature, cell, now);
          if (row) {
            // A polygon alert seen from several cells is one row; a zone alert is stored once per cell
            // (distinct external_id suffix) so proximity matching stays local to where it applies.
            if (!row.geometry) row.external_id = `${row.external_id}#${cell.key}`;
            rows.push(row);
            active.add(row.external_id);
          }
        }
        expired += await expireMissingAlerts(sb, cell, active);
        polledCells += 1;
      } catch (error) {
        failedCells += 1;
        log.warn('nws alerts cell failed', { cell: cell.key, ...errorFields(error) });
      }
    }
    if (cells.length > 0 && polledCells === 0) throw new Error('Every NWS alert cell failed');
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { cells: cells.length, polledCells, failedCells, expired } };
  },
};
