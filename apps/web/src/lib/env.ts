/** Public (browser-safe) configuration. Values are inlined at build time by Next.js. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
};

export function hasSupabaseConfig(): boolean {
  return publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;
}

export function requireSupabaseConfig(): { url: string; anonKey: string } {
  if (!hasSupabaseConfig()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).',
    );
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

/** Server-only secrets. Never import from a client component. */
export const serverEnv = {
  get serviceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  },
  get nwsUserAgent(): string {
    return process.env.NWS_USER_AGENT || '(AllClear, unknown-contact)';
  },
};
