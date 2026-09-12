import { Tornado } from 'lucide-react';
import { formatMiles, type StormDTO } from '@allclear/shared';
import { formatDateTime } from '@/lib/format';
import { HazardSection } from './section';

function compass(deg: number | null): string {
  if (deg === null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? '';
}

/**
 * Only rendered when the National Hurricane Center is tracking an active system near this place.
 * Quiet otherwise (no card), so the page doesn't fill with "nothing to see" boxes outside hurricane season.
 */
export function StormsNotice({ storms }: { storms: StormDTO[] }) {
  if (storms.length === 0) return null;
  return (
    <HazardSection title="Tropical Storms" source="nhc" icon={<Tornado className="h-4 w-4" aria-hidden />} id="storms">
      <ul className="flex flex-col gap-3" aria-label="Active tropical systems">
        {storms.map((s) => {
          const mph = s.intensity_kt !== null ? Math.round(s.intensity_kt * 1.15078) : null;
          const danger = mph !== null && mph >= 74;
          return (
            <li
              key={s.id}
              className={
                danger ? 'rounded-card border border-alert/30 bg-alert-soft/60 p-4' : 'rounded-card border border-accent/30 bg-accent-soft/60 p-4'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">
                  {s.classification} {s.name}
                </span>
                {s.distance_miles !== null ? (
                  <span className="text-sm tabular-nums text-slate-700">Centre {formatMiles(s.distance_miles)} away</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-800">
                {mph !== null ? `Maximum sustained winds ${mph} mph` : 'Wind speed not reported'}
                {danger ? ' (hurricane force)' : ''}
                {s.pressure_mb !== null ? ` · ${s.pressure_mb} mb` : ''}
                {s.movement_mph !== null ? ` · moving ${compass(s.movement_dir)} at ${Math.round(s.movement_mph)} mph` : ''}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {s.last_update ? `Advisory ${formatDateTime(s.last_update)} · ` : ''}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                    Full NHC advisory
                  </a>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </HazardSection>
  );
}
