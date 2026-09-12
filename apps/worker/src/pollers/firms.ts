import { fetchText } from '../http';
import type { EventInsert } from '../db';
import { upsertEvents } from '../db';
import type { Poller, PollerContext } from './types';

const SATELLITES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
const HOTSPOT_TTL_HOURS = 24;

/** Parse the FIRMS area CSV. Columns vary slightly by product, so we read the header. */
export function parseFirmsCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header || !header.toLowerCase().startsWith('latitude')) {
    throw new Error(`Unexpected FIRMS response: ${csv.slice(0, 80)}`);
  }
  const cols = header.split(',').map((c) => c.trim());
  return lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const values = line.split(',');
      const row: Record<string, string> = {};
      cols.forEach((c, i) => (row[c] = (values[i] ?? '').trim()));
      return row;
    });
}

export function normalizeFirms(row: Record<string, string>, product: string, now: Date): EventInsert | null {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const date = row.acq_date ?? '';
  const time = (row.acq_time ?? '0000').padStart(4, '0');
  const occurred = new Date(`${date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`);
  if (Number.isNaN(occurred.getTime())) return null;
  return {
    source: 'firms',
    external_id: `${product}:${lat.toFixed(4)}:${lng.toFixed(4)}:${date}:${time}`,
    event_type: 'fire_hotspot',
    title: 'Satellite hotspot',
    severity: row.confidence ?? null,
    latitude: lat,
    longitude: lng,
    occurred_at: occurred.toISOString(),
    attributes: {
      confidence: row.confidence ?? null,
      satellite: product,
      instrument: row.instrument ?? null,
      frp: row.frp ? Number(row.frp) : null,
      daynight: row.daynight ?? null,
      bright_ti4: row.bright_ti4 ? Number(row.bright_ti4) : null,
    },
    raw_payload: row,
    fetched_at: now.toISOString(),
    expires_at: new Date(occurred.getTime() + HOTSPOT_TTL_HOURS * 3_600_000).toISOString(),
  };
}

export const firmsPoller: Poller = {
  name: 'firms',
  layers: ['wildfire'],
  intervalMinutes: (c) => c.POLL_FIRMS_MINUTES,
  disabledReason: (c) => (c.NASA_FIRMS_MAP_KEY ? null : 'NASA_FIRMS_MAP_KEY is not set'),
  async run({ sb, config, now }: PollerContext) {
    const rows: EventInsert[] = [];
    const perProduct: Record<string, number> = {};
    for (const product of SATELLITES) {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${config.NASA_FIRMS_MAP_KEY}/${product}/${config.FIRMS_BBOX}/1`;
      const csv = await fetchText(url, { timeoutMs: 60_000 });
      const parsed = parseFirmsCsv(csv);
      let count = 0;
      for (const r of parsed) {
        const row = normalizeFirms(r, product, now);
        if (row) {
          rows.push(row);
          count += 1;
        }
      }
      perProduct[product] = count;
    }
    const written = await upsertEvents(sb, rows);
    return { rows: written, details: { perProduct, bbox: config.FIRMS_BBOX } };
  },
};
