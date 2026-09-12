import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPinned, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDashboard } from '@/lib/data/dashboard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LocationCard } from '@/components/dashboard/location-card';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = await createClient();
  const cards = await getDashboard(supabase);

  return (
    <>
      <PageHeader
        title="Your Watch List"
        description={cards.length ? 'Tap a place for the full breakdown.' : undefined}
        actions={
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="h-4 w-4" aria-hidden /> Add location
            </Link>
          </Button>
        }
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="h-8 w-8" aria-hidden />}
          title="Add your first location"
          description="Save home, a family member's city or an upcoming trip, and we'll show weather, fires, quakes, air quality and official alerts for it here."
          action={
            <Button size="lg" asChild>
              <Link href="/onboarding">
                <Plus className="h-4 w-4" aria-hidden /> Add a location
              </Link>
            </Button>
          }
          className="py-16"
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map(({ location, summary, error }) => (
            <li key={location.id}>
              <LocationCard location={location} summary={summary} error={error} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
