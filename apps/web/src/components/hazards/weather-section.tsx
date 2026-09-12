import { CloudSun, Sun, Wind } from 'lucide-react';
import { uvCategory, type WeatherDTO } from '@allclear/shared';
import { formatHour, formatTemp } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { HazardSection } from './section';

function windLine(wind_mph: number | null, wind_dir: string | null, gust: number | null): string | null {
  if (wind_mph === null && gust === null) return null;
  const parts: string[] = [];
  if (wind_mph !== null) parts.push(`Wind ${wind_dir ? `${wind_dir} ` : ''}${Math.round(wind_mph)} mph`);
  if (gust !== null && (wind_mph === null || gust > wind_mph)) parts.push(`gusts to ${Math.round(gust)} mph`);
  return parts.join(', ');
}

function uvTone(tone: ReturnType<typeof uvCategory>['tone']): 'good' | 'warning' | 'danger' {
  if (tone === 'good') return 'good';
  if (tone === 'moderate' || tone === 'sensitive') return 'warning';
  return 'danger';
}

export function WeatherSection({ weather }: { weather: WeatherDTO }) {
  const { current, hourly, daily, uv } = weather;
  const hasData = current || hourly.length > 0 || daily.length > 0;
  const wind = current ? windLine(current.wind_mph, current.wind_dir, current.wind_gust_mph) : null;
  const uvInfo = uv ? uvCategory(uv.uv_index) : null;
  return (
    <HazardSection title="Weather" source="nws" fetchedAt={weather.fetched_at} stale={weather.stale} icon={<CloudSun className="h-4 w-4" aria-hidden />} id="weather">
      {!hasData ? (
        <EmptyState
          title="Forecast not loaded yet"
          description="We refresh National Weather Service forecasts every 15 minutes. Check back shortly."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {current ? (
            <div className="flex items-end gap-4">
              <span className="text-5xl font-semibold tabular-nums tracking-tight">{formatTemp(current.temp_f)}</span>
              <div className="pb-1 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{current.conditions}</p>
                <p>
                  {current.humidity_pct !== null ? `Humidity ${Math.round(current.humidity_pct)}%` : null}
                  {current.humidity_pct !== null && wind ? ' · ' : null}
                  {wind}
                </p>
                <p className="text-xs text-slate-500">
                  {current.basis === 'observation' ? `Observed at ${current.station ?? 'nearby station'}` : 'From the hourly forecast'}
                </p>
              </div>
            </div>
          ) : null}

          {uv && uvInfo ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-slate-50 px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <Sun className="h-4 w-4 text-accent" aria-hidden /> UV index {uv.uv_index}
              </span>
              <Badge tone={uvTone(uvInfo.tone)}>{uvInfo.name}</Badge>
              <span className="text-slate-600">{uvInfo.advice}</span>
              <span className="basis-full text-xs text-slate-500">
                Source: EPA UV Index forecast{uv.date ? ` for ${uv.date}` : ''}
                {uv.stale ? ' (may be stale)' : ''}
              </span>
            </div>
          ) : null}

          {hourly.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Next hours</h4>
              <ol className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Hourly forecast">
                {hourly.slice(0, 12).map((h) => (
                  <li key={h.time} className="flex min-w-[72px] flex-col items-center rounded-control bg-slate-50 px-2 py-2 text-center">
                    <span className="text-xs text-slate-500">{formatHour(h.time)}</span>
                    <span className="text-base font-semibold tabular-nums">{formatTemp(h.temp_f)}</span>
                    <span className="line-clamp-2 text-[11px] leading-tight text-slate-600">{h.conditions}</span>
                    {h.precip_pct ? <span className="text-[11px] text-primary">{h.precip_pct}% rain</span> : null}
                    {h.wind_mph !== null ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                        <Wind className="h-3 w-3" aria-hidden />
                        {h.wind_dir ? `${h.wind_dir} ` : ''}
                        {Math.round(h.wind_mph)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {daily.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">7-day forecast</h4>
              <ol className="divide-y divide-slate-100" aria-label="Daily forecast">
                {daily.slice(0, 7).map((d) => (
                  <li key={d.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="w-24 shrink-0 font-medium text-slate-800">{d.name}</span>
                    <span className="flex-1 truncate text-slate-600">{d.conditions}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold">{formatTemp(d.high_f)}</span>
                      <span className="text-slate-400"> / {formatTemp(d.low_f)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </HazardSection>
  );
}
