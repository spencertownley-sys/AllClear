import 'server-only';
import { createAdminClient, type TypedSupabaseClient } from '@nimbuswatch/shared';
import { requireSupabaseConfig, serverEnv } from '@/lib/env';

let adminClient: TypedSupabaseClient | null = null;

/**
 * Service-role client. Only for the documented privileged server operations: account deletion,
 * 403-vs-404 ownership checks, and the signed one-click email unsubscribe (lib/data/unsubscribe.ts),
 * which only touches the single rule named by a verified HMAC token.
 */
export function getAdminClient(): TypedSupabaseClient | null {
  const key = serverEnv.serviceRoleKey;
  if (!key) return null;
  if (adminClient) return adminClient;
  const { url } = requireSupabaseConfig();
  adminClient = createAdminClient(url, key);
  return adminClient;
}
