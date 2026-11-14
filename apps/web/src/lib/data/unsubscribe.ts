import 'server-only';
import { ApiError } from '@nimbuswatch/shared';
import { verifyUnsubscribeToken } from '@nimbuswatch/shared/unsubscribe';
import { serverEnv } from '@/lib/env';
import { getAdminClient } from '@/lib/supabase/admin';

/** The rule id a genuine unsubscribe token is for, or null for a forged, mangled or unconfigured one. */
export function ruleIdFromToken(token: string): string | null {
  const secret = serverEnv.unsubscribeSecret;
  if (!secret) return null;
  return verifyUnsubscribeToken(token, secret);
}

/**
 * Stop alert emails for one rule (NW-10). The person clicking is usually not signed in, so after the
 * HMAC check passes this is one of the documented getAdminClient() cases (CLAUDE.md rule 4): it only
 * ever touches the single rule named by the signed token. 'both' keeps push; an email-only rule is
 * switched off. Idempotent, as RFC 8058 one-click requires.
 */
export async function disableEmailForRule(ruleId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new ApiError('INTERNAL_ERROR', 'Unsubscribing is not configured on this deployment yet.');
  const { data: rule, error } = await admin.from('notification_rules').select('id, channel').eq('id', ruleId).maybeSingle();
  if (error) {
    console.error('[unsubscribe] load rule failed', error.message);
    throw new ApiError('INTERNAL_ERROR', 'Could not update your notification settings. Please try again.');
  }
  if (!rule) return; // rule or location already deleted: nothing left to email
  const patch = rule.channel === 'both' ? { channel: 'web_push' as const } : rule.channel === 'email' ? { enabled: false } : null;
  if (!patch) return;
  const { error: updateError } = await admin.from('notification_rules').update(patch).eq('id', ruleId);
  if (updateError) {
    console.error('[unsubscribe] update rule failed', updateError.message);
    throw new ApiError('INTERNAL_ERROR', 'Could not update your notification settings. Please try again.');
  }
}
