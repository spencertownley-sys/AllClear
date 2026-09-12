import 'server-only';
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@allclear/shared';
import { hasSupabaseConfig, requireSupabaseConfig } from '@/lib/env';

/** Cookie-backed Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  // Read cookies first: it marks the render as dynamic, so a build never tries to prerender
  // an authenticated page (and never needs real Supabase credentials).
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Returns the authenticated user, or null. Verified against Supabase Auth (not just the cookie). */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Like getCurrentUser, but never throws: returns null when Supabase isn't configured or the
 * session can't be verified. Memoised per request so layouts and pages share one auth call.
 */
export const getOptionalUser = cache(async () => {
  if (!hasSupabaseConfig()) return null;
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
});
