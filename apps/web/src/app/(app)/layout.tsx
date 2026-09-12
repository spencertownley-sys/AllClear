import { redirect } from 'next/navigation';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';

/** Per-user content: never prerendered at build time. */
export const dynamic = 'force-dynamic';

/** Authenticated shell: Dashboard, Location Detail, Alerts, Settings, Onboarding. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect('/login');
  return <AppShell user={{ email: user.email ?? null }}>{children}</AppShell>;
}
