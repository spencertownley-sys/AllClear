import Link from 'next/link';
import { Activity, AlertTriangle, ChevronRight, Flame, ShieldCheck, Star } from 'lucide-react';
import type { DashboardSummaryRow, WatchLocation } from '@allclear/shared';
import { formatTemp, placeLine } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AqiBadge } from '@/components/hazards/aqi-badge';

interface LocationCardProps {
  location: WatchLocation;
  summary: DashboardSummaryRow | null;
  error?: boolean;
}

/** Glanceable status per Watch Location (UI/UX Notes §7 dashboard wireframe). */
export function LocationCard({ location, summary, error }: LocationCardProps) {
  const place = placeLine(location);
  const fires = (summary?.fire_count ?? 0) + (summary?.incident_count ?? 0);
  const quakes = summary?.quake_count ?? 0;
  const alerts = summary?.alert_count ?? 0;
  const aqi = summary?.aqi ?? null;
  const weather = summary?.weather_current ?? null;
  const nothingToReport = !error && summary && fires === 0 && quakes === 0 && alerts === 0 && (aqi === null || aqi <= 100);
  const alertDanger = summary?.top_alert_severity === 'Extreme' || summary?.top_alert_severity === 'Severe';

  return (
    <Link href={`/dashboard/${location.id}`} className="group block rounded-card focus-visible:outline-2 focus-visible:outline-primary">
      <Card className="flex h-full flex-col gap-3 p-5 transition-shadow group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 truncate text-lg font-semibold text-slate-900">
              {location.is_primary ? <Star className="h-4 w-4 shrink-0 fill-accent text-accent" aria-label="Primary location" /> : null}
              {location.label}
            </h2>
            {place ? <p className="truncate text-sm text-slate-500">{place}</p> : null}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>

        {alerts > 0 ? (
          <div
            className={
              alertDanger
                ? 'flex items-center gap-2 rounded-control border border-alert/30 bg-alert-soft px-3 py-2 text-sm font-medium text-alert-foreground'
                : 'flex items-center gap-2 rounded-control border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent-foreground'
            }
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">
              {summary?.top_alert_event ?? 'Official alert'}
              {alerts > 1 ? ` +${alerts - 1} more` : ''}
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-control bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Couldn&apos;t load conditions for this location. Open it to retry.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {weather ? (
              <Badge tone="neutral" className="text-sm">
                {formatTemp(weather.temp_f)} · {weather.conditions}
              </Badge>
            ) : (
              <Badge tone="neutral">Forecast pending</Badge>
            )}
            {fires > 0 ? (
              <Badge tone="danger">
                <Flame className="h-3.5 w-3.5" aria-hidden /> {fires} fire{fires === 1 ? '' : 's'} nearby
              </Badge>
            ) : null}
            {quakes > 0 ? (
              <Badge tone="purple">
                <Activity className="h-3.5 w-3.5" aria-hidden /> {quakes} quake{quakes === 1 ? '' : 's'}
                {summary?.max_quake_magnitude ? ` · up to M${Number(summary.max_quake_magnitude).toFixed(1)}` : ''}
              </Badge>
            ) : null}
            {aqi !== null ? <AqiBadge aqi={aqi} /> : null}
            {nothingToReport ? (
              <Badge tone="good">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> No active hazards
              </Badge>
            ) : null}
          </div>
        )}
      </Card>
    </Link>
  );
}
