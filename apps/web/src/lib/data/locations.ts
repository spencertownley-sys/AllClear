import 'server-only';
import {
  ApiError,
  type CreateLocationInput,
  type LocationDTO,
  type TablesUpdate,
  type UpdateLocationInput,
  type WatchLocation,
} from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export function toLocationDTO(row: WatchLocation): LocationDTO {
  return {
    id: row.id,
    label: row.label,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    city_name: row.city_name,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    is_primary: row.is_primary,
    created_at: row.created_at,
  };
}

function normalize(row: WatchLocation): WatchLocation {
  return { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) };
}

export async function listLocations(supabase: ServerSupabaseClient): Promise<WatchLocation[]> {
  const { data, error } = await supabase
    .from('watch_locations')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not load your locations');
  return (data ?? []).map(normalize);
}

/**
 * Loads a location the current user owns. RLS hides other users' rows, so we distinguish
 * 404 from 403 (API Design §3) with a service-role existence check when one is configured.
 */
export async function getOwnedLocation(supabase: ServerSupabaseClient, id: string): Promise<WatchLocation> {
  const { data, error } = await supabase.from('watch_locations').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not load that location');
  if (data) return normalize(data);

  const admin = getAdminClient();
  if (admin) {
    const { data: exists } = await admin.from('watch_locations').select('id').eq('id', id).maybeSingle();
    if (exists) throw new ApiError('FORBIDDEN', 'That location belongs to another account');
  }
  throw new ApiError('NOT_FOUND', 'Location not found');
}

export async function createLocation(
  supabase: ServerSupabaseClient,
  userId: string,
  input: CreateLocationInput,
): Promise<WatchLocation> {
  const { data, error } = await supabase
    .from('watch_locations')
    .insert({
      user_id: userId,
      label: input.label,
      latitude: input.latitude,
      longitude: input.longitude,
      city_name: input.city_name ?? null,
      state: input.state ?? null,
      postal_code: input.postal_code ?? null,
      country: input.country ?? 'US',
      is_primary: input.is_primary ?? false,
    })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[locations] create failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not save that location');
  }
  return normalize(data);
}

export async function updateLocation(
  supabase: ServerSupabaseClient,
  id: string,
  input: UpdateLocationInput,
): Promise<WatchLocation> {
  await getOwnedLocation(supabase, id);
  const patch: TablesUpdate<'watch_locations'> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.city_name !== undefined) patch.city_name = input.city_name;
  if (input.state !== undefined) patch.state = input.state;
  if (input.postal_code !== undefined) patch.postal_code = input.postal_code;
  if (input.country !== undefined) patch.country = input.country;
  if (input.is_primary !== undefined) patch.is_primary = input.is_primary;

  const { data, error } = await supabase.from('watch_locations').update(patch).eq('id', id).select('*').single();
  if (error || !data) {
    console.error('[locations] update failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not update that location');
  }
  return normalize(data);
}

export async function deleteLocation(supabase: ServerSupabaseClient, id: string): Promise<void> {
  await getOwnedLocation(supabase, id);
  const { error } = await supabase.from('watch_locations').delete().eq('id', id);
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not remove that location');
}

export async function countLocations(supabase: ServerSupabaseClient): Promise<number> {
  const { count, error } = await supabase.from('watch_locations').select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}
