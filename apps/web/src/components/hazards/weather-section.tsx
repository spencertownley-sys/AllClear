import { CloudSun, Sun } from 'lucide-react';
import { uvCategory, type WeatherDTO } from '@allclear/shared';
import { formatTemp } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { HazardSection } from './section';
import { WeatherForecast } from './weather-forecast';

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

          <WeatherForecast weather={weather} />
        </div>
      )}
    </HazardSection>
  );
}
