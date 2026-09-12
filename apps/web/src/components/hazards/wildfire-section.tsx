import { Camera, Flame, History } from 'lucide-react';
import { FIRE_HISTORY_YEARS, formatMiles, type LocationHazardsResponse } from '@allclear/shared';
import { formatDateTime, formatNumber } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { HazardMap } from '@/components/map/hazard-map';
import { HazardSection } from './section';

type Wildfire = NonNullable<LocationHazardsResponse['wildfire']>;

interface Props {
  wildfire: Wildfire;
  center: { latitude: number; longitude: number; label: string };
}

function acresLine(acres: number | null): string {
  return acres !== null ? `${formatNumber(Math.round(acres))} acres` : 'size unknown';
}

export function WildfireSection({ wildfire, center }: Props) {
  const { hotspots, incidents, perimeters, history, cameras_url, radius_miles } = wildfire;
  const nothingActive = hotspots.length === 0 && incidents.length === 0 && perimeters.length === 0;
  const fires = [
    ...incidents.map((i) => ({
      latitude: i.latitude,
      longitude: i.longitude,
      detected_at: i.updated_at,
      source: i.source,
      kind: 'incident' as const,
      name: i.name,
      containment_pct: i.containment_pct,
      acres: i.acres,
    })),
    ...hotspots.map((h) => ({ latitude: h.latitude, longitude: h.longitude, detected_at: h.detected_at, source: h.source, kind: 'hotspot' as const })),
  ];
  const zoom = radius_miles <= 15 ? 10 : radius_miles <= 30 ? 9 : radius_miles <= 60 ? 8 : 7;
  const inside = perimeters.filter((p) => p.distance_miles <= 0.05);
  const historyAcres = history.reduce((sum, h) => sum + (h.acres ?? 0), 0);

  return (
    <HazardSection title="Wildfire & Smoke" source="firms" stale={wildfire.stale} icon={<Flame className="h-4 w-4" aria-hidden />} id="wildfire">
      <div className="flex flex-col gap-4">
        {inside.length > 0 ? (
          <p role="alert" className="rounded-control border border-alert/30 bg-alert-soft px-3 py-2 text-sm font-medium text-alert-foreground">
            Warning: this location is inside the mapped perimeter of the {inside[0]?.name}. Follow local evacuation orders.
          </p>
        ) : null}

        {nothingActive ? (
          <EmptyState
            tone="good"
            icon={<Flame className="h-6 w-6" aria-hidden />}
            title={`No active fires within ${radius_miles} miles`}
            description="No satellite hotspots, named incidents or mapped perimeters near this location right now."
          />
        ) : (
          <div className="h-64 overflow-hidden rounded-card border border-slate-200">
            <HazardMap
              center={[center.latitude, center.longitude]}
              zoom={zoom}
              fires={fires}
              perimeters={perimeters}
              history={history}
              pins={[{ latitude: center.latitude, longitude: center.longitude, label: center.label }]}
              interactive={false}
              className="h-64 w-full"
              ariaLabel={`Fires near ${center.label}`}
            />
          </div>
        )}

        {perimeters.length > 0 ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Mapped perimeters</h4>
            <ul className="divide-y divide-slate-100" aria-label="Active fire perimeters">
              {perimeters.map((p) => (
                <li key={p.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-700">
                      {p.distance_miles <= 0.05 ? 'Inside perimeter' : `${formatMiles(p.distance_miles)} to the edge`}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {p.containment_pct !== null ? `${Math.round(p.containment_pct)}% contained` : 'Containment unknown'} · {acresLine(p.acres)}
                    {p.updated_at ? ` · perimeter updated ${formatDateTime(p.updated_at)}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">Source: NIFC (WFIGS interagency perimeters)</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {incidents.length > 0 ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Named incidents</h4>
            <ul className="divide-y divide-slate-100" aria-label="Named incidents">
              {incidents.map((i) => (
                <li key={i.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">
                      {i.url ? (
                        <a href={i.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                          {i.name}
                        </a>
                      ) : (
                        i.name
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-700">{formatMiles(i.distance_miles)} away</span>
                  </div>
                  <p className="text-slate-600">
                    {i.containment_pct !== null ? `${Math.round(i.containment_pct)}% contained` : 'Containment unknown'}
                    {i.acres !== null ? ` · ${formatNumber(i.acres)} acres` : ''}
                    {i.status ? ` · ${i.status}` : ''}
                    {i.updated_at ? ` · updated ${formatDateTime(i.updated_at)}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">Source: NIFC / InciWeb</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hotspots.length > 0 ? (
          <p className="text-sm text-slate-700">
            <span className="font-medium">{hotspots.length}</span> satellite hotspot{hotspots.length === 1 ? '' : 's'} within {radius_miles} miles
            {hotspots[0] ? <span className="text-slate-500"> · nearest {formatMiles(hotspots[0].distance_miles)}</span> : null}
            <span className="block text-xs text-slate-500">
              Hotspots are automated heat detections and can include controlled burns, industrial sources or false positives.
            </span>
          </p>
        ) : null}

        <div className="rounded-card border border-slate-200 bg-slate-50 p-3">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <History className="h-3.5 w-3.5" aria-hidden /> Fire history · last {FIRE_HISTORY_YEARS} years
          </h4>
          {history.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No recorded wildfire perimeters within {radius_miles} miles in the last {FIRE_HISTORY_YEARS} years.
              <span className="block text-xs text-slate-500">History loads once a day from NIFC; a new location may take up to a day to fill in.</span>
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-medium">{history.length}</span> fire{history.length === 1 ? '' : 's'} burned within {radius_miles} miles
                {historyAcres > 0 ? <span className="text-slate-500"> · {formatNumber(Math.round(historyAcres))} acres total</span> : null}
                {nothingActive ? <span className="block text-xs text-slate-500">Past perimeters appear as dashed outlines on the map when a fire is active.</span> : null}
              </p>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Past fires">
                {history.slice(0, 10).map((h) => (
                  <li key={h.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-slate-800">
                      {h.name}
                      {h.year ? <span className="text-slate-500"> ({h.year})</span> : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {acresLine(h.acres)} · {formatMiles(h.distance_miles)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-xs text-slate-500">Source: NIFC interagency fire perimeter history</p>
        </div>

        <p className="inline-flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
          <Camera className="h-4 w-4 text-slate-500" aria-hidden />
          <a href={cameras_url} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            Open ALERTWildfire live cameras
          </a>
          <span className="text-xs text-slate-500">(free public camera network, opens in a new tab)</span>
        </p>
      </div>
    </HazardSection>
  );
}
