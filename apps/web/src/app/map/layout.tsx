import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';

/** Per-user content: never prerendered at build time. */
export const dynamic = 'force-dynamic';

/** The Map is public — it renders the shell for logged-in and logged-out visitors alike. */
export default async function MapLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  return <AppShell user={user ? { email: user.email ?? null } : null}>{children}</AppShell>;
}
