import { Activity } from 'lucide-react';
import { formatMiles, type LocationHazardsResponse, type SafetyCheckinDTO } from '@allclear/shared';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { SafetyCheckInButton } from '@/components/safety/safety-checkin-button';
import { HazardSection } from './section';

type Quakes = NonNullable<LocationHazardsResponse['earthquakes']>;

interface Props {
  earthquakes: Quakes;
  locationId: string;
  checkins: SafetyCheckinDTO[];
}

export function EarthquakeSection({ earthquakes, locationId, checkins }: Props) {
  const { events, radius_miles, min_magnitude } = earthquakes;
  const checkinByEvent = new Map(checkins.filter((c) => c.hazard_event_id).map((c) => [c.hazard_event_id as string, c]));
  return (
    <HazardSection title="Earthquakes" source="usgs" stale={earthquakes.stale} icon={<Activity className="h-4 w-4" aria-hidden />} id="earthquakes">
      {events.length === 0 ? (
        <EmptyState
          tone="good"
          icon={<Activity className="h-6 w-6" aria-hidden />}
          title={`No M${min_magnitude.toFixed(1)}+ quakes within ${radius_miles} miles`}
          description="Nothing above your magnitude threshold in the past week."
        />
      ) : (
        <ul className="divide-y divide-slate-100" aria-label="Recent earthquakes">
          {events.slice(0, 15).map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  <span className="mr-2 inline-block rounded-control bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-900">
                    M{q.magnitude.toFixed(1)}
                  </span>
                  {q.url ? (
                    <a href={q.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                      {q.place}
                    </a>
                  ) : (
                    q.place
                  )}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(q.occurred_at)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular-nums text-slate-700">{formatMiles(q.distance_miles)} away</span>
                <SafetyCheckInButton
                  locationId={locationId}
                  hazardEventId={q.id}
                  eventType="earthquake"
                  eventTitle={`M${q.magnitude.toFixed(1)} — ${q.place}`}
                  initialCheckin={checkinByEvent.get(q.id) ?? null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </HazardSection>
  );
}
