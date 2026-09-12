import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import type { NotificationRuleDTO } from '@allclear/shared';
import { createClient } from '@/lib/supabase/server';
import { listLocations, toLocationDTO } from '@/lib/data/locations';
import { toRuleDTO } from '@/lib/data/rules';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationSettings } from '@/components/notifications/notification-settings';

export const metadata: Metadata = { title: 'Notification settings' };

export default async function NotificationSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const focus = typeof params.location === 'string' ? params.location : null;
  const supabase = await createClient();
  const locations = await listLocations(supabase);

  // One query for every rule the user owns (RLS scopes it), grouped client-side — no N+1.
  const { data: ruleRows } = await supabase.from('notification_rules').select('*');
  const rulesByLocation = new Map<string, NotificationRuleDTO[]>();
  for (const row of ruleRows ?? []) {
    const list = rulesByLocation.get(row.watch_location_id) ?? [];
    list.push(toRuleDTO(row));
    rulesByLocation.set(row.watch_location_id, list);
  }

  return (
    <>
      <PageHeader
        title="Notification settings"
        description="Set your own thresholds per place. Changes save automatically."
      />
      {locations.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="h-8 w-8" aria-hidden />}
          title="Add a Watch Location first to set notification rules"
          action={
            <Button asChild>
              <Link href="/onboarding">Add a location</Link>
            </Button>
          }
          className="py-16"
        />
      ) : (
        <NotificationSettings
          locations={locations.map((l) => ({ ...toLocationDTO(l), rules: rulesByLocation.get(l.id) ?? [] }))}
          focusLocationId={focus}
        />
      )}
    </>
  );
}
