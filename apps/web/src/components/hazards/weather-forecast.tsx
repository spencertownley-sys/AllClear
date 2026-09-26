'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, TrendingUp } from 'lucide-react';
import { SOURCE_LABELS, type WeatherDTO, type WeatherDaily, type WeatherHourly } from '@allclear/shared';
import { formatHour, formatTemp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

type Tab = 'hourly' | 'daily' | 'weekly';

function dayKey(iso: string): string {
  // Group by the local calendar date encoded in the timestamp (both NWS and Open-Meteo carry the offset).
  return iso.slice(0, 10);
}

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function tendency(part: { category: string; probability: number | null } | null, kind: 'temperature' | 'precipitation'): string {
  if (!part) return 'No outlook';
  const word = part.category === 'Above' ? (kind === 'temperature' ? 'warmer than normal' : 'wetter than normal') : part.category === 'Below' ? (kind === 'temperature' ? 'cooler than normal' : 'drier than normal') : 'near normal';
  return part.probability !== null ? `${word} (${Math.round(part.probability)}% chance)` : word;
}

function sourceNote(rows: Array<{ source?: string }>): string {
  const sources = Array.from(new Set(rows.map((r) => r.source ?? 'nws')));
  return sources.map((s) => SOURCE_LABELS[s as keyof typeof SOURCE_LABELS] ?? s).join(' + ');
}

/** Hourly / daily / weekly forecast tabs (client-side state only; data comes pre-merged from the server). */
export function WeatherForecast({ weather }: { weather: WeatherDTO }) {
  const [tab, setTab] = useState<Tab>('hourly');
  const days = useMemo(() => {
    const groups = new Map<string, WeatherHourly[]>();
    for (const h of weather.hourly) {
      const key = dayKey(h.time);
      groups.set(key, [...(groups.get(key) ?? []), h]);
    }
    return Array.from(groups.entries());
  }, [weather.hourly]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = selectedDay && days.some(([k]) => k === selectedDay) ? selectedDay : (days[0]?.[0] ?? null);
  const hours = days.find(([k]) => k === activeDay)?.[1] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex rounded-control border border-slate-300 p-0.5" role="tablist" aria-label="Forecast view">
        {(
          [
            ['hourly', 'Hour by hour', Clock3],
            ['daily', `${weather.daily.length || 16}-day`, CalendarDays],
            ['weekly', 'By week', TrendingUp],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium',
              tab === id ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === 'hourly' ? (
        days.length === 0 ? (
          <EmptyState title="Hourly forecast not loaded yet" description="Hour-by-hour data refreshes every 15 minutes from NWS and every 3 hours from Open-Meteo." />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Pick a day">
              {days.map(([key]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === activeDay}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                    key === activeDay ? 'border-primary bg-primary-soft text-primary' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {shortDay(key)}
                </button>
              ))}
            </div>
            <ol className="divide-y divide-slate-100" aria-label={`Hourly forecast for ${activeDay ? shortDay(activeDay) : 'today'}`}>
              {hours.map((h) => (
                <li key={h.time} className="grid grid-cols-[4.5rem_3.5rem_1fr_auto] items-center gap-2 py-1.5 text-sm">
                  <span className="text-slate-500">{formatHour(h.time)}</span>
                  <span className="font-semibold tabular-nums">{formatTemp(h.temp_f)}</span>
                  <span className="truncate text-slate-700">{h.conditions}</span>
                  <span className="text-right text-xs tabular-nums text-slate-500">
                    {h.precip_pct ? `${h.precip_pct}% rain` : ''}
                    {h.precip_pct && h.wind_mph !== null ? ' · ' : ''}
                    {h.wind_mph !== null ? `${h.wind_dir ? `${h.wind_dir} ` : ''}${Math.round(h.wind_mph)} mph` : ''}
                    {h.wind_gust_mph ? ` (gusts ${Math.round(h.wind_gust_mph)})` : ''}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500">Source: {sourceNote(hours)}</p>
          </div>
        )
      ) : null}

      {tab === 'daily' ? (
        weather.daily.length === 0 ? (
          <EmptyState title="Daily forecast not loaded yet" description="Days 1–7 come from NWS, days 8–16 from Open-Meteo. Check back in a few minutes." />
        ) : (
          <div className="flex flex-col gap-2">
            <ol className="divide-y divide-slate-100" aria-label="Daily forecast">
              {weather.daily.map((d: WeatherDaily) => (
                <li key={d.date} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                    <span className="w-28 shrink-0 font-medium text-slate-800">{d.name}</span>
                    <span className="text-xs text-slate-500">{shortDay(d.date).replace(/^\w+,\s*/, '')}</span>
                  </div>
                  <span className="flex-1 truncate text-slate-600">{d.conditions}</span>
                  <span className="flex items-center gap-3 text-xs tabular-nums text-slate-500 sm:shrink-0">
                    {d.precip_pct ? <span>{d.precip_pct}% rain</span> : null}
                    {typeof d.precip_in === 'number' && d.precip_in >= 0.05 ? <span>{d.precip_in.toFixed(2)} in</span> : null}
                    {typeof d.wind_mph === 'number' ? <span>wind {Math.round(d.wind_gust_mph ?? d.wind_mph)} mph</span> : null}
                    <span className="text-sm">
                      <span className="font-semibold text-slate-900">{formatTemp(d.high_f)}</span>
                      <span className="text-slate-400"> / {formatTemp(d.low_f)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500">Source: NWS for the first 7 days, Open-Meteo beyond (model forecast, less certain the further out you look).</p>
          </div>
        )
      ) : null}

      {tab === 'weekly' ? (
        <div className="flex flex-col gap-4">
          {weather.weeks.length === 0 ? (
            <EmptyState title="Weekly outlook not loaded yet" description="Week-by-week summaries are built from the 16-day forecast once it has loaded." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Week by week">
              {weather.weeks.map((w) => (
                <li key={w.start_date} className="rounded-card border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {w.label} · {shortDay(w.start_date).replace(/^\w+,\s*/, '')} – {shortDay(w.end_date).replace(/^\w+,\s*/, '')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatTemp(w.avg_high_f)} <span className="text-base font-normal text-slate-400">/ {formatTemp(w.avg_low_f)}</span>
                  </p>
                  <p className="text-sm text-slate-700">{w.conditions || 'Mixed'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {w.total_precip_in !== null ? `${w.total_precip_in.toFixed(2)} in rain` : 'Rain amount n/a'}
                    {w.max_precip_pct !== null ? ` · up to ${w.max_precip_pct}% chance` : ''}
                    {w.max_wind_mph !== null ? ` · winds to ${Math.round(w.max_wind_mph)} mph` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-card border border-slate-200 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Climate Prediction Center outlook</h4>
            {!weather.outlook ? (
              <p className="mt-1 text-sm text-slate-600">
                No CPC outlook for this spot yet. NOAA issues 6–10 and 8–14 day outlooks for the US daily; they load within about 12 hours of adding a location.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {weather.outlook.periods.map((p) => (
                  <li key={p.key} className="text-sm">
                    <p className="font-medium text-slate-800">
                      {p.label} · {shortDay(p.start_date).replace(/^\w+,\s*/, '')} – {shortDay(p.end_date).replace(/^\w+,\s*/, '')}
                    </p>
                    <p className="text-slate-700">Temperature: {tendency(p.temperature, 'temperature')}</p>
                    <p className="text-slate-700">Precipitation: {tendency(p.precipitation, 'precipitation')}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Source: NOAA Climate Prediction Center{weather.outlook?.issued_at ? ` · issued ${new Date(weather.outlook.issued_at).toLocaleDateString()}` : ''}. Probabilities are the chance of running above or below the 30-year normal.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
