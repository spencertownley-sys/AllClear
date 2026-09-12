import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, getOptionalUser } from '@/lib/supabase/server';
import { listLocations, toLocationDTO } from '@/lib/data/locations';
import { PageHeader } from '@/components/ui/page-header';
import { AccountSettings } from '@/components/account/account-settings';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getOptionalUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const locations = await listLocations(supabase);
  return (
    <>
      <PageHeader title="Account" />
      <AccountSettings email={user.email ?? ''} locations={locations.map(toLocationDTO)} />
    </>
  );
}
