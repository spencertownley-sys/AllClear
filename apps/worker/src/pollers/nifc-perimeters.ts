import type { Json } from '@allclear/shared';
import { fetchJson } from '../http';
import { bboxCenter, geojsonToEwkt, vertexCount } from '../geojson';
import { upsertEvents, type EventInsert } from '../db';
import type { Poller, PollerContext } from './types';

/** NIFC WFIGS "Interagency Perimeters — Current" (public ArcGIS feature service). */
export const DEFAULT_PERIMETERS_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';
const PAGE = 500;
const TTL_HOURS = 24;
const MAX_VERTICES = 20_000;

export interface PerimeterFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    poly_IncidentName?: string | null;
    poly_GISAcres?: number | null;
    poly_DateCurrent?: number | null;
    attr_PercentContained?: number | null;
    attr_IncidentTypeCategory?: string | null;
    attr_FireDiscoveryDateTime?: number | null;
    attr_ModifiedOnDateTime_dt?: number | null;
    attr_UniqueFireIdentifier?: string | null;
    attr_IrwinID?: string | null;
    attr_POOState?: string | null;
    attr_IncidentSize?: number | null;
  };
}

export function displayFireName(name: string): string {
  const trimmed = name.trim();
  return /fire|complex|\brx\b|prescribed/i.test(trimmed) ? trimmed : `${trimmed} Fire`;
}

export function normalizePerimeter(feature: PerimeterFeature, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!feature.geometry || !p.poly_IncidentName) return null;
  if (vertexCount(feature.geometry) > MAX_VERTICES) return null;
  const geometry = geojsonToEwkt(feature.geometry);
  const center = bboxCenter(feature.geometry);
  if (!geometry || !center) return null;
  const id = p.attr_IrwinID ?? p.attr_UniqueFireIdentifier ?? `${p.poly_IncidentName}:${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}`;
  const updated = p.poly_DateCurrent ?? p.attr_ModifiedOnDateTime_dt ?? null;
  return {
    source: 'inciweb',
    external_id: `nifc-perim:${id}`,
    event_type: 'fire_perimeter',
    title: displayFireName(p.poly_IncidentName),
    severity: null,
    latitude: center.latitude,
    longitude: center.longitude,
    geometry,
    occurred_at: p.attr_FireDiscoveryDateTime ? new Date(p.attr_FireDiscoveryDateTime).toISOString() : null,
    attributes: {
      acres: typeof p.poly_GISAcres === 'number' ? Math.round(p.poly_GISAcres) : typeof p.attr_IncidentSize === 'number' ? Math.round(p.attr_IncidentSize) : null,
      containment_pct: typeof p.attr_PercentContained === 'number' ? p.attr_PercentContained : null,
      updated_at: updated ? new Date(updated).toISOString() : null,
      state: p.attr_POOState ?? null,
      irwin_id: p.attr_IrwinID ?? null,
      provider: 'nifc-wfigs-perimeters',
    },
    raw_payload: p as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_HOURS * 3_600_000).toISOString(),
  };
}

export const nifcPerimetersPoller: Poller = {
  name: 'nifc_perimeters',
  layers: ['wildfire'],
  intervalMinutes: (c) => c.POLL_NIFC_PERIMETERS_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    const base = config.NIFC_PERIMETERS_URL || DEFAULT_PERIMETERS_URL;
    const rows: EventInsert[] = [];
    let skipped = 0;
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const url = new URL(base);
      url.searchParams.set('where', "attr_IncidentTypeCategory IN ('WF','CX')");
      url.searchParams.set(
        'outFields',
        'poly_IncidentName,poly_GISAcres,poly_DateCurrent,attr_PercentContained,attr_IncidentTypeCategory,attr_FireDiscoveryDateTime,attr_ModifiedOnDateTime_dt,attr_UniqueFireIdentifier,attr_IrwinID,attr_POOState,attr_IncidentSize',
      );
      url.searchParams.set('f', 'geojson');
      url.searchParams.set('outSR', '4326');
      url.searchParams.set('geometryPrecision', '4');
      url.searchParams.set('maxAllowableOffset', '0.0005');
      url.searchParams.set('resultRecordCount', String(PAGE));
      url.searchParams.set('resultOffset', String(offset));
      const data = await fetchJson<{ features?: PerimeterFeature[]; properties?: { exceededTransferLimit?: boolean }; error?: { message: string } }>(url.toString(), { timeoutMs: 90_000 });
      if (data.error) throw new Error(`NIFC perimeters error: ${data.error.message}`);
      for (const f of data.features ?? []) {
        const row = normalizePerimeter(f, now);
        if (row) rows.push(row);
        else skipped += 1;
      }
      if (!data.properties?.exceededTransferLimit || (data.features ?? []).length === 0) break;
      offset += PAGE;
    }
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { skipped } };
  },
};
