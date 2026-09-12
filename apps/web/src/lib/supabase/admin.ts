import 'server-only';
import { createAdminClient, type TypedSupabaseClient } from '@allclear/shared';
import { requireSupabaseConfig, serverEnv } from '@/lib/env';

let adminClient: TypedSupabaseClient | null = null;

/** Service-role client. Only for privileged server operations (account deletion, ownership checks). */
export function getAdminClient(): TypedSupabaseClient | null {
  const key = serverEnv.serviceRoleKey;
  if (!key) return null;
  if (adminClient) return adminClient;
  const { url } = requireSupabaseConfig();
  adminClient = createAdminClient(url, key);
  return adminClient;
}
