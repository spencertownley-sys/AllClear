import 'server-only';
import {
  ApiError,
  validateRuleUpdate,
  type CreateRuleInput,
  type NotificationRule,
  type NotificationRuleDTO,
  type TablesUpdate,
  type UpdateRuleInput,
} from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

export function toRuleDTO(row: NotificationRule): NotificationRuleDTO {
  return {
    id: row.id,
    layer_type: row.layer_type,
    condition_type: row.condition_type,
    threshold_value: row.threshold_value === null ? null : Number(row.threshold_value),
    channel: row.channel,
    enabled: row.enabled,
    min_interval_minutes: row.min_interval_minutes,
  };
}

export async function listRules(supabase: ServerSupabaseClient, locationId: string): Promise<NotificationRuleDTO[]> {
  const { data, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('watch_location_id', locationId)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not load notification rules');
  return (data ?? []).map(toRuleDTO);
}

export async function createRule(
  supabase: ServerSupabaseClient,
  locationId: string,
  input: CreateRuleInput,
): Promise<NotificationRuleDTO> {
  const { data, error } = await supabase
    .from('notification_rules')
    .insert({
      watch_location_id: locationId,
      layer_type: input.layer_type,
      condition_type: input.condition_type,
      threshold_value: input.condition_type === 'any_active' ? null : (input.threshold_value ?? null),
      channel: input.channel,
      enabled: input.enabled,
      min_interval_minutes: input.min_interval_minutes ?? null,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ApiError('CONFLICT', 'A rule for this layer already exists on this location. Edit it instead.');
    }
    console.error('[rules] create failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not save that rule');
  }
  return toRuleDTO(data);
}

async function getOwnedRule(supabase: ServerSupabaseClient, locationId: string, ruleId: string): Promise<NotificationRule> {
  const { data, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('watch_location_id', locationId)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not load that rule');
  if (!data) throw new ApiError('NOT_FOUND', 'Rule not found');
  return data;
}

export async function updateRule(
  supabase: ServerSupabaseClient,
  locationId: string,
  ruleId: string,
  input: UpdateRuleInput,
): Promise<NotificationRuleDTO> {
  const existing = await getOwnedRule(supabase, locationId, ruleId);
  const check = validateRuleUpdate(existing, input);
  if (!check.ok) {
    throw new ApiError('VALIDATION_ERROR', check.message, [{ field: 'threshold_value', message: check.message }]);
  }
  const patch: TablesUpdate<'notification_rules'> = {};
  if (input.threshold_value !== undefined) patch.threshold_value = input.threshold_value;
  if (input.channel !== undefined) patch.channel = input.channel;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.min_interval_minutes !== undefined) patch.min_interval_minutes = input.min_interval_minutes;
  const { data, error } = await supabase.from('notification_rules').update(patch).eq('id', ruleId).select('*').single();
  if (error || !data) throw new ApiError('INTERNAL_ERROR', 'Could not update that rule');
  return toRuleDTO(data);
}

export async function deleteRule(supabase: ServerSupabaseClient, locationId: string, ruleId: string): Promise<void> {
  await getOwnedRule(supabase, locationId, ruleId);
  const { error } = await supabase.from('notification_rules').delete().eq('id', ruleId);
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not remove that rule');
}
