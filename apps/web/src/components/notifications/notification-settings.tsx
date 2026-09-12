'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LocationDTO, NotificationRuleDTO } from '@allclear/shared';
import { placeLine } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RuleEditor } from './rule-editor';
import { PushEnable } from './push-enable';

interface LocationWithRules extends LocationDTO {
  rules: NotificationRuleDTO[];
}

interface Props {
  locations: LocationWithRules[];
  focusLocationId: string | null;
}

/** List of Watch Locations, each expandable to its layer-specific threshold controls. */
export function NotificationSettings({ locations, focusLocationId }: Props) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(focusLocationId && locations.some((l) => l.id === focusLocationId) ? [focusLocationId] : locations.length === 1 ? [locations[0]!.id] : []),
  );
  const [ruleCounts, setRuleCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(locations.map((l) => [l.id, l.rules.filter((r) => r.enabled).length])),
  );
  const hasRules = useMemo(() => Object.values(ruleCounts).some((n) => n > 0), [ruleCounts]);

  const onRulesChange = useCallback((id: string) => (count: number) => setRuleCounts((c) => (c[id] === count ? c : { ...c, [id]: count })), []);

  function toggle(id: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PushEnable hasRules={hasRules} />
      <ul className="flex flex-col gap-3">
        {locations.map((location) => {
          const expanded = open.has(location.id);
          const count = ruleCounts[location.id] ?? 0;
          const panelId = `rules-${location.id}`;
          return (
            <li key={location.id} className="rounded-card border border-slate-200 bg-white">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(location.id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">{location.label}</span>
                  <span className="block text-sm text-slate-500">
                    {placeLine(location) || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`} ·{' '}
                    {count === 0 ? 'No rules yet' : `${count} rule${count === 1 ? '' : 's'} on`}
                  </span>
                </span>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} aria-hidden />
              </button>
              <div id={panelId} hidden={!expanded} className="border-t border-slate-200 p-4">
                {expanded ? (
                  <RuleEditor
                    locationId={location.id}
                    locationLabel={location.label}
                    initialRules={location.rules}
                    onRulesChange={onRulesChange(location.id)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
