import { createAdminClient, type CachedWeather, type Database, type Json, type LocationLayer, type TypedSupabaseClient, type WatchLocation } from '@allclear/shared';
import type { WorkerConfig } from './config';
import { log } from './logger';

export type EventInsert = Database['public']['Tables']['cached_hazard_events']['Insert'];
export type WeatherInsert = Database['public']['Tables']['cached_weather']['Insert'];

export interface WatchLocationWithLayers extends WatchLocation {
  location_layers: LocationLayer[];
}

let client: TypedSupabaseClient | null = null;

export function db(config: WorkerConfig): TypedSupabaseClient {
  if (!config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — the worker cannot write to the hazard caches without it.');
  }
  if (!client) client = createAdminClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  return client;
}

/** For tests / poll-once: inject a client. */
export function setDbClient(c: TypedSupabaseClient) {
  client = c;
}

export async function getWatchLocations(sb: TypedSupabaseClient): Promise<WatchLocationWithLayers[]> {
  const { data, error } = await sb.from('watch_locations').select('*, location_layers(*)');
  if (error) throw new Error(`load watch_locations failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    location_layers: (row.location_layers ?? []) as LocationLayer[],
  }));
}

const CHUNK = 500;

/** Upsert normalized events, de-duplicated on (source, external_id). Returns rows written. */
export async function upsertEvents(sb: TypedSupabaseClient, rows: EventInsert[]): Promise<number> {
  // De-duplicate within the batch — PostgreSQL rejects the same conflict key twice in one statement.
  const seen = new Map<string, EventInsert>();
  for (const row of rows) seen.set(`${row.source}:${row.external_id}`, row);
  const unique = Array.from(seen.values());
  let written = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { error } = await sb.from('cached_hazard_events').upsert(chunk, { onConflict: 'source,external_id' });
    if (error) throw new Error(`upsert cached_hazard_events failed: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

export async function upsertWeather(sb: TypedSupabaseClient, rows: WeatherInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await sb.from('cached_weather').upsert(rows, { onConflict: 'grid_key' });
  if (error) throw new Error(`upsert cached_weather failed: ${error.message}`);
  return rows.length;
}

/** Mark alerts for a polled cell that are no longer returned as expired (cancelled early). */
export async function expireMissingAlerts(
  sb: TypedSupabaseClient,
  cell: { latitude: number; longitude: number },
  activeExternalIds: Set<string>,
): Promise<number> {
  const { data, error } = await sb
    .from('cached_hazard_events')
    .select('id, external_id')
    .eq('source', 'nws')
    .eq('event_type', 'severe_alert')
    .eq('latitude', cell.latitude)
    .eq('longitude', cell.longitude)
    .is('geometry', null)
    .or('expires_at.is.null,expires_at.gt.now()');
  if (error) throw new Error(`select alerts for cell failed: ${error.message}`);
  const gone = (data ?? []).filter((r) => !activeExternalIds.has(r.external_id)).map((r) => r.id);
  if (gone.length === 0) return 0;
  const { error: updErr } = await sb.from('cached_hazard_events').update({ expires_at: new Date().toISOString() }).in('id', gone);
  if (updErr) throw new Error(`expire alerts failed: ${updErr.message}`);
  return gone.length;
}

export async function deleteExpired(sb: TypedSupabaseClient, keepDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
  const { error } = await sb.from('cached_hazard_events').delete().lt('expires_at', cutoff);
  if (error) log.warn('cleanup cached_hazard_events failed', { error: error.message });
  const { error: runsErr } = await sb.from('poller_runs').delete().lt('started_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
  if (runsErr) log.warn('cleanup poller_runs failed', { error: runsErr.message });
}

export async function recordRunStart(sb: TypedSupabaseClient, source: string): Promise<number | null> {
  const { data, error } = await sb.from('poller_runs').insert({ source, status: 'running' }).select('id').single();
  if (error) {
    log.warn('poller_runs insert failed', { source, error: error.message });
    return null;
  }
  return data.id;
}

export async function recordRunEnd(
  sb: TypedSupabaseClient,
  id: number | null,
  patch: { status: 'success' | 'error'; rows_upserted: number; error?: string | null; details?: Record<string, unknown> },
): Promise<void> {
  if (id === null) return;
  const { error } = await sb
    .from('poller_runs')
    .update({ ...patch, finished_at: new Date().toISOString(), details: (patch.details ?? {}) as Json })
    .eq('id', id);
  if (error) log.warn('poller_runs update failed', { id, error: error.message });
}

export type { CachedWeather };
