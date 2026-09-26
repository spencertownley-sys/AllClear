import 'server-only';
import { ApiError, type CreateCheckinInput, type SafetyCheckinDTO } from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Personal "I'm safe" markers (Rules: personal record only, never shared — see safety_checkins
 * migration). RLS already scopes every row to the current user; `watchLocationId` further scopes
 * these calls to one location, whose ownership the caller has already verified with
 * `getOwnedLocation`.
 */
export async function listCheckins(supabase: ServerSupabaseClient, watchLocationId: string): Promise<SafetyCheckinDTO[]> {
  const { data, error } = await supabase
    .from('safety_checkins')
    .select('id, watch_location_id, hazard_event_id, event_type, event_title, note, created_at')
    .eq('watch_location_id', watchLocationId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[safety] list failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not load your safety check-ins');
  }
  return (data ?? []) as SafetyCheckinDTO[];
}

export async function createCheckin(
  supabase: ServerSupabaseClient,
  userId: string,
  watchLocationId: string,
  input: CreateCheckinInput,
): Promise<SafetyCheckinDTO> {
  // Re-marking safe against the same event is a no-op: return the existing check-in rather than
  // erroring on the unique (user_id, hazard_event_id) index.
  if (input.hazard_event_id) {
    const { data: existing } = await supabase
      .from('safety_checkins')
      .select('id, watch_location_id, hazard_event_id, event_type, event_title, note, created_at')
      .eq('watch_location_id', watchLocationId)
      .eq('hazard_event_id', input.hazard_event_id)
      .maybeSingle();
    if (existing) return existing as SafetyCheckinDTO;
  }
  const { data, error } = await supabase
    .from('safety_checkins')
    .insert({
      user_id: userId,
      watch_location_id: watchLocationId,
      hazard_event_id: input.hazard_event_id ?? null,
      event_type: input.event_type,
      event_title: input.event_title,
      note: input.note ?? null,
    })
    .select('id, watch_location_id, hazard_event_id, event_type, event_title, note, created_at')
    .single();
  if (error || !data) {
    console.error('[safety] create failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not save your check-in');
  }
  return data as SafetyCheckinDTO;
}

export async function deleteCheckin(supabase: ServerSupabaseClient, watchLocationId: string, id: string): Promise<void> {
  const { error } = await supabase.from('safety_checkins').delete().eq('watch_location_id', watchLocationId).eq('id', id);
  if (error) {
    console.error('[safety] delete failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not remove that check-in');
  }
}
