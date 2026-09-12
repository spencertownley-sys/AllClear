import webpush from 'web-push';
import type { PushSubscriptionRow, TypedSupabaseClient } from '@allclear/shared';
import type { WorkerConfig } from '../config';
import { log, errorFields } from '../logger';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let configured = false;

export function pushEnabled(config: WorkerConfig): boolean {
  return Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

function ensureConfigured(config: WorkerConfig) {
  if (configured) return;
  webpush.setVapidDetails(config.VAPID_SUBJECT || `mailto:${new URL(config.APP_URL).hostname}`, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
  configured = true;
}

export async function loadSubscriptions(sb: TypedSupabaseClient, userId: string): Promise<PushSubscriptionRow[]> {
  const { data, error } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
  if (error) throw new Error(`load push_subscriptions failed: ${error.message}`);
  return data ?? [];
}

/** Sends to every subscription; prunes endpoints the push service reports as gone (404/410). */
export async function sendPush(
  sb: TypedSupabaseClient,
  config: WorkerConfig,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<number> {
  if (!pushEnabled(config) || subscriptions.length === 0) return 0;
  ensureConfigured(config);
  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 3600, urgency: 'high' },
      );
      delivered += 1;
      await sb.from('push_subscriptions').update({ last_used_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        log.info('push subscription gone; removing', { id: sub.id, status });
        await sb.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        log.warn('push send failed', { id: sub.id, status, ...errorFields(error) });
        await sb.from('push_subscriptions').update({ failure_count: sub.failure_count + 1 }).eq('id', sub.id);
      }
    }
  }
  return delivered;
}
