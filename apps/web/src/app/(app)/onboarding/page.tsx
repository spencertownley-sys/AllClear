import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { countLocations } from '@/lib/data/locations';
import { parseWizardParams } from '@/lib/wizard-params';
import { AddLocationWizard } from '@/components/location/add-location-wizard';

export const metadata: Metadata = { title: 'Get started' };

/** First-time only: users who already have a Watch Location go to the regular add flow. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const count = await countLocations(supabase);
  if (count > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string') qs.set(k, v);
    redirect(`/dashboard/new${qs.size ? `?${qs.toString()}` : ''}`);
  }
  return <AddLocationWizard firstTime initial={parseWizardParams(params)} />;
}
