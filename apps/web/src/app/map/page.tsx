import type { Metadata } from 'next';
import { getOptionalUser } from '@/lib/supabase/server';
import { LiveMap } from '@/components/map/live-map';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Live map' };

export default async function MapPage() {
  const user = await getOptionalUser();
  return (
    <>
      <PageHeader
        title="Live hazard map"
        description="Active satellite fire detections, named incidents and recent earthquakes across the US. No account needed."
      />
      <LiveMap loggedIn={Boolean(user)} />
    </>
  );
}
