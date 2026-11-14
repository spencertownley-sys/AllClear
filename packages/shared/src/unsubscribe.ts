import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Signed one-click unsubscribe tokens for alert emails (NW-10). The token is
 * `<rule id>.<base64url HMAC-SHA256(rule id)>` keyed with UNSUBSCRIBE_SECRET, shared by the worker
 * (which puts it in the email) and the web app (which verifies it). Server-only: it uses node:crypto,
 * so it is a separate entry point (`@nimbuswatch/shared/unsubscribe`) and not re-exported from the
 * package index that client components import.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const unsubscribeTokenSchema = z.object({
  t: z.string().regex(new RegExp(`^${UUID}\\.[A-Za-z0-9_-]{43}$`, 'i'), 'Invalid unsubscribe link'),
});

function mac(ruleId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsubscribe:${ruleId.toLowerCase()}`).digest('base64url');
}

export function signUnsubscribeToken(ruleId: string, secret: string): string {
  return `${ruleId.toLowerCase()}.${mac(ruleId, secret)}`;
}

/** Returns the rule id when the token is genuine, otherwise null. Constant-time comparison. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || !unsubscribeTokenSchema.safeParse({ t: token }).success) return null;
  const [ruleId, signature] = token.split('.') as [string, string];
  const expected = Buffer.from(mac(ruleId, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return ruleId.toLowerCase();
}

/** The link that goes in the email and in the List-Unsubscribe header. */
export function unsubscribeUrl(appUrl: string, ruleId: string, secret: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/notifications/unsubscribe?t=${signUnsubscribeToken(ruleId, secret)}`;
}
