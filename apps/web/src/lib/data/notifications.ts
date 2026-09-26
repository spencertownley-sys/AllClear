import 'server-only';
import { ApiError, type NotificationHistoryItemDTO } from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

export interface NotificationHistoryPage {
  data: NotificationHistoryItemDTO[];
  meta: { page: number; limit: number; total: number };
}

export async function listNotifications(
  supabase: ServerSupabaseClient,
  page: number,
  limit: number,
): Promise<NotificationHistoryPage> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await supabase
    .from('notifications_log')
    .select('id, layer_type, summary, channel, sent_at, watch_locations(label), notification_rules(condition_type, threshold_value)', { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(from, to);
  if (error) {
    console.error('[notifications] list failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not load your alert history');
  }
  return {
    data: (data ?? []).map((row) => {
      const location = row.watch_locations;
      const label = location?.label;
      const rule = row.notification_rules;
      return {
        id: row.id,
        watch_location_label: label ?? 'Removed location',
        layer_type: row.layer_type,
        summary: row.summary,
        channel: row.channel,
        sent_at: row.sent_at,
        condition_type: rule?.condition_type ?? null,
        threshold_value: rule?.threshold_value ?? null,
      };
    }),
    meta: { page, limit, total: count ?? 0 },
  };
}
