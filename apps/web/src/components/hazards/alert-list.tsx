'use client';

import { useState } from 'react';
import { ALERT_CATEGORY_LABELS, alertCategory, type AlertCategory, type OfficialAlertDTO } from '@allclear/shared';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SeverityBadge, alertClass } from './severity-badge';

/** Category chips (Flood / Fire / Wind / …) that filter the active alert list; "All" is always available. */
export function AlertList({ alerts }: { alerts: OfficialAlertDTO[] }) {
  const [filter, setFilter] = useState<AlertCategory | 'all'>('all');
  const counts = new Map<AlertCategory, number>();
  for (const a of alerts) {
    const c = alertCategory(a.event);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const categories = [...counts.keys()];
  const visible = filter === 'all' ? alerts : alerts.filter((a) => alertCategory(a.event) === filter);

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter alerts by category">
          <button
            type="button"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
            className={cn(
              'min-h-9 rounded-full border px-3 text-sm font-medium',
              filter === 'all' ? 'border-primary/40 bg-primary-soft text-primary' : 'border-slate-300 bg-white text-slate-600',
            )}
          >
            All ({alerts.length})
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={cn(
                'min-h-9 rounded-full border px-3 text-sm font-medium',
                filter === c ? 'border-primary/40 bg-primary-soft text-primary' : 'border-slate-300 bg-white text-slate-600',
              )}
            >
              {ALERT_CATEGORY_LABELS[c]} ({counts.get(c)})
            </button>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3" aria-label="Active official alerts">
        {visible.map((a) => {
          const cls = alertClass(a.event);
          const category = alertCategory(a.event);
          const danger = cls === 'Warning' || a.severity === 'Extreme' || a.severity === 'Severe';
          return (
            <li
              key={a.id}
              className={danger ? 'rounded-card border border-alert/30 bg-alert-soft/60 p-4' : 'rounded-card border border-accent/30 bg-accent-soft/60 p-4'}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{a.event}</span>
                <SeverityBadge severity={a.severity} />
                <span className="text-xs text-slate-600">{cls}</span>
                <span className="rounded-full bg-white/70 px-2 text-xs text-slate-600">{ALERT_CATEGORY_LABELS[category]}</span>
              </div>
              {a.headline ? <p className="mt-1 text-sm text-slate-800">{a.headline}</p> : null}
              {a.instruction ? <p className="mt-2 text-sm text-slate-700">{a.instruction}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {a.sender ? `${a.sender} · ` : ''}
                {a.expires_at ? `expires ${formatDateTime(a.expires_at)}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
