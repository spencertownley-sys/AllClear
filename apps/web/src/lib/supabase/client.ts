'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@allclear/shared';
import { requireSupabaseConfig } from '@/lib/env';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = requireSupabaseConfig();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
