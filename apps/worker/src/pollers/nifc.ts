import { XMLParser } from 'fast-xml-parser';
import { parseDms, type Json } from '@allclear/shared';
import { fetchJson, fetchText } from '../http';
import { upsertEvents, type EventInsert } from '../db';
import { log, errorFields } from '../logger';
import type { Poller, PollerContext } from './types';

/**
 * Primary structured source: NIFC's public WFIGS "Current Wildland Fire Incident Locations"
 * ArcGIS feature service (Tech Spec §5 assumption). Override with NIFC_INCIDENTS_URL.
 */
export const DEFAULT_NIFC_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query';
const INCIWEB_RSS = 'https://inciweb.wildfire.gov/incidents/rss.xml';
const INCIDENT_TTL_HOURS = 24;
const PAGE = 1000;
const RECENT_DAYS = 14;

export interface NifcFeature {
  geometry: { type: 'Point'; coordinates: [number, number] } | null;
  properties: {
    IncidentName?: string | null;
    PercentContained?: number | null;
    IncidentSize?: number | null;
    DiscoveryAcres?: number | null;
    IncidentTypeCategory?: string | null;
    FireDiscoveryDateTime?: number | null;
    ModifiedOnDateTime_dt?: number | null;
    UniqueFireIdentifier?: string | null;
    IrwinID?: string | null;
    POOState?: string | null;
    POOCounty?: string | null;
    IncidentShortDescription?: string | null;
    TotalIncidentPersonnel?: number | null;
    IncidentManagementOrganization?: string | null;
    FireCause?: string | null;
    FireOutDateTime?: number | null;
  };
}

function displayName(name: string): string {
  const trimmed = name.trim();
  return /fire|complex|\brx\b|prescribed/i.test(trimmed) ? trimmed : `${trimmed} Fire`;
}

export function normalizeNifc(feature: NifcFeature, now: Date): EventInsert | null {
  const p = feature.properties;
  if (!feature.geometry || !p.IncidentName) return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const id = p.IrwinID ?? p.UniqueFireIdentifier;
  if (!id) return null;
  const acres = p.IncidentSize ?? p.DiscoveryAcres ?? null;
  return {
    source: 'inciweb',
    external_id: `nifc:${id}`,
    event_type: 'fire_incident',
    title: displayName(p.IncidentName),
    description: p.IncidentShortDescription ?? null,
    severity: null,
    latitude: lat,
    longitude: lng,
    occurred_at: p.FireDiscoveryDateTime ? new Date(p.FireDiscoveryDateTime).toISOString() : null,
    attributes: {
      containment_pct: typeof p.PercentContained === 'number' ? p.PercentContained : null,
      acres: typeof acres === 'number' ? acres : null,
      status: p.FireOutDateTime ? 'Out' : 'Active',
      updated_at: p.ModifiedOnDateTime_dt ? new Date(p.ModifiedOnDateTime_dt).toISOString() : null,
      state: p.POOState ?? null,
      county: p.POOCounty ?? null,
      personnel: p.TotalIncidentPersonnel ?? null,
      cause: p.FireCause ?? null,
      management: p.IncidentManagementOrganization ?? null,
      provider: 'nifc-wfigs',
      url: null,
    },
    raw_payload: p as unknown as Json,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + INCIDENT_TTL_HOURS * 3_600_000).toISOString(),
  };
}

async function fetchNifc(baseUrl: string, now: Date): Promise<EventInsert[]> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
  const where = `IncidentTypeCategory IN ('WF','CX') AND FireOutDateTime IS NULL AND ModifiedOnDateTime_dt >= TIMESTAMP '${since}'`;
  const outFields = [
    'IncidentName', 'PercentContained', 'IncidentSize', 'DiscoveryAcres', 'IncidentTypeCategory', 'FireDiscoveryDateTime',
    'ModifiedOnDateTime_dt', 'UniqueFireIdentifier', 'IrwinID', 'POOState', 'POOCounty', 'IncidentShortDescription',
    'TotalIncidentPersonnel', 'IncidentManagementOrganization', 'FireCause', 'FireOutDateTime',
  ].join(',');
  const rows: EventInsert[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const url = new URL(baseUrl);
    url.searchParams.set('where', where);
    url.searchParams.set('outFields', outFields);
    url.searchParams.set('f', 'geojson');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultRecordCount', String(PAGE));
    url.searchParams.set('resultOffset', String(offset));
    const data = await fetchJson<{ features?: NifcFeature[]; properties?: { exceededTransferLimit?: boolean }; error?: { message: string } }>(url.toString(), { timeoutMs: 45_000 });
    if (data.error) throw new Error(`NIFC error: ${data.error.message}`);
    for (const f of data.features ?? []) {
      const row = normalizeNifc(f, now);
      if (row) rows.push(row);
    }
    if (!data.properties?.exceededTransferLimit || (data.features ?? []).length === 0) break;
    offset += PAGE;
  }
  return rows;
}

// ---- Fallback: InciWeb RSS (narrative + DMS coordinates in the description) ----

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

export function parseInciwebDescription(description: string): { latitude: number; longitude: number; state: string | null; updated: string | null; type: string | null } | null {
  const text = description.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  const latMatch = /Latitude:\s*([-\d°'".\s]+?)\s+Longitude:/i.exec(text);
  const lngMatch = /Longitude:\s*([-\d°'".\s]+?)(?:\s{2,}|\n|---|$)/i.exec(text);
  if (!latMatch || !lngMatch) return null;
  const lat = parseDms(latMatch[1] ?? '');
  const lngRaw = parseDms(lngMatch[1] ?? '');
  if (lat === null || lngRaw === null) return null;
  // InciWeb prints western longitudes as positive numbers; all US fires are in the western hemisphere.
  const lng = lngRaw > 0 ? -lngRaw : lngRaw;
  const state = /State:\s*([A-Za-z ]+?)(?:\s{2,}|---|$)/i.exec(text)?.[1]?.trim() ?? null;
  const updated = /Last updated:\s*([\d-]+)/i.exec(text)?.[1] ?? null;
  const type = /type of incident is\s+([A-Za-z ]+?)\s+and/i.exec(text)?.[1]?.trim() ?? null;
  return { latitude: lat, longitude: lng, state, updated, type };
}

export function normalizeInciwebItem(item: RssItem, now: Date): EventInsert | null {
  if (!item.title || !item.link || !item.description) return null;
  const parsed = parseInciwebDescription(item.description);
  if (!parsed) return null;
  if (parsed.type && !/wildfire|complex/i.test(parsed.type)) return null;
  // Titles look like "WAOWF Three Queens" — a unit code followed by the incident name.
  const name = item.title.replace(/^[A-Z0-9]{4,6}\s+/, '').trim();
  return {
    source: 'inciweb',
    external_id: `inciweb:${item.link}`,
    event_type: 'fire_incident',
    title: displayName(name),
    description: null,
    severity: null,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    occurred_at: parsed.updated ? new Date(`${parsed.updated}T00:00:00Z`).toISOString() : null,
    attributes: {
      containment_pct: null,
      acres: null,
      status: 'Active',
      updated_at: parsed.updated ? new Date(`${parsed.updated}T00:00:00Z`).toISOString() : null,
      state: parsed.state,
      provider: 'inciweb-rss',
      url: item.link,
    },
    raw_payload: { title: item.title, link: item.link, pubDate: item.pubDate ?? null },
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + INCIDENT_TTL_HOURS * 3_600_000).toISOString(),
  };
}

export async function fetchInciwebRss(now: Date, url = INCIWEB_RSS): Promise<EventInsert[]> {
  const xml = await fetchText(url, { timeoutMs: 30_000, headers: { 'User-Agent': 'AllClear worker' } });
  const parser = new XMLParser({ ignoreAttributes: true });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const items = doc.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return list.map((item) => normalizeInciwebItem(item, now)).filter((r): r is EventInsert => r !== null);
}

export const nifcPoller: Poller = {
  name: 'nifc',
  layers: ['wildfire'],
  intervalMinutes: (c) => c.POLL_NIFC_MINUTES,
  disabledReason: () => null,
  async run({ sb, config, now }: PollerContext) {
    let rows: EventInsert[] = [];
    let provider = 'nifc-wfigs';
    try {
      rows = await fetchNifc(config.NIFC_INCIDENTS_URL || DEFAULT_NIFC_URL, now);
    } catch (error) {
      log.warn('NIFC feed failed; falling back to InciWeb RSS', errorFields(error));
      provider = 'inciweb-rss';
      rows = await fetchInciwebRss(now);
    }
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { provider, degraded: provider !== 'nifc-wfigs' } };
  },
};
