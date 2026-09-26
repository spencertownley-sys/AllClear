import { ShieldCheck, Siren } from 'lucide-react';
import type { OfficialAlertDTO, SafetyCheckinDTO } from '@allclear/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertList } from './alert-list';
import { HazardSection } from './section';

interface Props {
  alerts: OfficialAlertDTO[];
  locationId: string;
  checkins: SafetyCheckinDTO[];
}

export function AlertsSection({ alerts, locationId, checkins }: Props) {
  return (
    <HazardSection title="Official Alerts" source="nws" icon={<Siren className="h-4 w-4" aria-hidden />} id="official-alerts">
      {alerts.length === 0 ? (
        <EmptyState
          tone="good"
          icon={<ShieldCheck className="h-6 w-6" aria-hidden />}
          title="No active alerts for this location"
          description="No watches, warnings or advisories from the National Weather Service right now."
        />
      ) : (
        <AlertList alerts={alerts} locationId={locationId} checkins={checkins} />
      )}
    </HazardSection>
  );
}
