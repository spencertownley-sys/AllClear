import type { Metadata } from 'next';
import { parseWizardParams } from '@/lib/wizard-params';
import { AddLocationWizard } from '@/components/location/add-location-wizard';

export const metadata: Metadata = { title: 'Add a location' };

export default async function NewLocationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AddLocationWizard firstTime={false} initial={parseWizardParams(params)} />;
}
