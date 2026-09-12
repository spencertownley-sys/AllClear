'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AQI_LIMITS,
  DEFAULT_MIN_INTERVAL_MINUTES,
  DEFAULT_THRESHOLDS,
  LAYER_LABELS,
  MAGNITUDE_LIMITS,
  NOTIFICATION_LAYER_TYPES,
  RULE_FREQUENCY_OPTIONS,
  VALID_RULE_COMBOS,
  type Channel,
  type ConditionType,
  type NotificationLayerType,
  type NotificationRuleDTO,
} from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

interface RuleEditorProps {
  locationId: string;
  locationLabel: string;
  initialRules?: NotificationRuleDTO[];
  onRulesChange?: (count: number) => void;
}

const HELP: Record<NotificationLayerType, string> = {
  wildfire: 'Notify me when a fire is detected within this many miles.',
  earthquake: 'Notify me about quakes at or above this magnitude inside my watch radius.',
  air_quality: 'Notify me when the AQI reaches this value.',
  official_alerts: 'Notify me about any new NWS watch, warning or advisory.',
  weather: 'Notify me only about Severe or Extreme weather warnings.',
};

function thresholdLabel(condition: ConditionType, value: number | null): string {
  if (value === null) return '';
  switch (condition) {
    case 'distance_threshold_miles':
      return `${Math.round(value)} miles`;
    case 'magnitude_threshold':
      return `M${value.toFixed(1)}+`;
    case 'aqi_threshold':
      return `AQI ${Math.round(value)}+`;
    default:
      return '';
  }
}

/**
 * "Every update" is stored as the minimum allowed interval (15 min) for layers whose default is a
 * roll-up (wildfire, AQI) and as null for layers that already notify per event; null otherwise
 * means "use the default", which the selector shows as the effective choice.
 */
const EVERY_UPDATE_MINUTES = 15;

function effectiveInterval(rule: NotificationRuleDTO, condition: ConditionType): number | null {
  const v = rule.min_interval_minutes ?? DEFAULT_MIN_INTERVAL_MINUTES[condition];
  return v !== null && v <= EVERY_UPDATE_MINUTES ? null : v;
}

function intervalLabel(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? 'day' : `${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? 'hour' : `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

function intervalPatchValue(minutes: number | null, condition: ConditionType): number | null {
  if (minutes !== null) return minutes;
  return DEFAULT_MIN_INTERVAL_MINUTES[condition] === null ? null : EVERY_UPDATE_MINUTES;
}

function sliderProps(condition: ConditionType): { min: number; max: number; step: number } {
  switch (condition) {
    case 'distance_threshold_miles':
      return { min: 1, max: 100, step: 1 };
    case 'magnitude_threshold':
      return { min: MAGNITUDE_LIMITS.min, max: 8, step: 0.1 };
    case 'aqi_threshold':
      return { min: AQI_LIMITS.min, max: 300, step: 1 };
    default:
      return { min: 0, max: 1, step: 1 };
  }
}

/**
 * Per-location, per-layer threshold controls with per-section auto-save and a toast
 * (UI/UX Notes §3 "Notification Settings").
 */
export function RuleEditor({ locationId, locationLabel, initialRules, onRulesChange }: RuleEditorProps) {
  const [rules, setRules] = useState<NotificationRuleDTO[] | null>(initialRules ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<{ data: NotificationRuleDTO[] }>(`/api/locations/${locationId}/notification-rules`);
      setRules(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load notification rules"));
    }
  }, [locationId]);

  useEffect(() => {
    if (initialRules) return;
    // Deferred so the fetch starts after the render commits (no synchronous setState in the effect).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [initialRules, load]);

  useEffect(() => {
    if (rules) onRulesChange?.(rules.filter((r) => r.enabled).length);
  }, [rules, onRulesChange]);

  function ruleFor(layer: NotificationLayerType) {
    return rules?.find((r) => r.layer_type === layer) ?? null;
  }

  async function toggle(layer: NotificationLayerType, enabled: boolean) {
    const condition = VALID_RULE_COMBOS[layer][0] as ConditionType;
    const existing = ruleFor(layer);
    setBusy((b) => ({ ...b, [layer]: true }));
    try {
      if (!existing && enabled) {
        const created = await apiFetch<NotificationRuleDTO>(`/api/locations/${locationId}/notification-rules`, {
          method: 'POST',
          json: { layer_type: layer, condition_type: condition, threshold_value: DEFAULT_THRESHOLDS[condition], channel: 'both' },
        });
        setRules((r) => [...(r ?? []), created]);
        toast.success(`${LAYER_LABELS[layer]} alerts on for ${locationLabel}`);
      } else if (existing) {
        const updated = await apiFetch<NotificationRuleDTO>(
          `/api/locations/${locationId}/notification-rules/${existing.id}`,
          { method: 'PATCH', json: { enabled } },
        );
        setRules((r) => (r ?? []).map((x) => (x.id === updated.id ? updated : x)));
        toast.success(`${LAYER_LABELS[layer]} alerts ${enabled ? 'on' : 'off'} for ${locationLabel}`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save that change"));
    } finally {
      setBusy((b) => ({ ...b, [layer]: false }));
    }
  }

  function scheduleSave(rule: NotificationRuleDTO, patch: { threshold_value?: number; channel?: Channel; min_interval_minutes?: number | null }) {
    // Optimistic local update, debounced save, toast on success/failure — never silent.
    setRules((r) => (r ?? []).map((x) => (x.id === rule.id ? { ...x, ...patch } : x)));
    const key = rule.id;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      try {
        const updated = await apiFetch<NotificationRuleDTO>(`/api/locations/${locationId}/notification-rules/${rule.id}`, {
          method: 'PATCH',
          json: patch,
        });
        setRules((r) => (r ?? []).map((x) => (x.id === updated.id ? updated : x)));
        toast.success('Saved', { duration: 1500 });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't save — your change was not applied"));
        void load();
      }
    }, 600);
  }

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (!rules) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {NOTIFICATION_LAYER_TYPES.map((l) => (
          <Skeleton key={l} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-card border border-slate-200 bg-white">
      {NOTIFICATION_LAYER_TYPES.map((layer) => {
        const rule = ruleFor(layer);
        const enabled = Boolean(rule?.enabled);
        const condition = (rule?.condition_type ?? VALID_RULE_COMBOS[layer][0]) as ConditionType;
        const hasThreshold = condition !== 'any_active';
        const switchId = `rule-${locationId}-${layer}`;
        const value = rule?.threshold_value ?? DEFAULT_THRESHOLDS[condition] ?? 0;
        const { min, max, step } = sliderProps(condition);
        return (
          <li key={layer} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor={switchId} className="font-medium text-slate-900">
                  {LAYER_LABELS[layer]}
                </label>
                <p className="mt-0.5 text-sm text-slate-500">{HELP[layer]}</p>
              </div>
              <Switch
                id={switchId}
                checked={enabled}
                disabled={Boolean(busy[layer])}
                onCheckedChange={(v) => void toggle(layer, v)}
                aria-label={`${LAYER_LABELS[layer]} notifications`}
              />
            </div>
            {rule && enabled ? (
              <div className="flex flex-col gap-3">
                {hasThreshold ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <label htmlFor={`${switchId}-threshold`} className="text-slate-700">
                        Threshold
                      </label>
                      <span className="font-medium tabular-nums text-slate-900">{thresholdLabel(condition, value)}</span>
                    </div>
                    <Slider
                      id={`${switchId}-threshold`}
                      min={min}
                      max={max}
                      step={step}
                      value={[value]}
                      onValueChange={([v]) => v !== undefined && scheduleSave(rule, { threshold_value: v })}
                      aria-label={`${LAYER_LABELS[layer]} threshold`}
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-700">How often</span>
                  <div className="inline-flex rounded-control border border-slate-300 p-0.5" role="radiogroup" aria-label="Notification frequency">
                    {RULE_FREQUENCY_OPTIONS.map((opt) => {
                      const selected = effectiveInterval(rule, condition) === opt.minutes;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => scheduleSave(rule, { min_interval_minutes: intervalPatchValue(opt.minutes, condition) })}
                          className={
                            selected
                              ? 'min-h-9 rounded-[6px] bg-primary px-3 text-sm font-medium text-white'
                              : 'min-h-9 rounded-[6px] px-3 text-sm font-medium text-slate-600 hover:bg-slate-100'
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="basis-full text-xs text-slate-500">
                    {(() => {
                      const every = effectiveInterval(rule, condition);
                      return every === null
                        ? 'You get a message as soon as something new matches this rule.'
                        : `At most one message per ${intervalLabel(every)} for this rule; anything new is rolled into it.`;
                    })()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-700">Send via</span>
                  <div className="inline-flex rounded-control border border-slate-300 p-0.5" role="radiogroup" aria-label="Notification channel">
                    {(['web_push', 'email', 'both'] as Channel[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={rule.channel === c}
                        onClick={() => scheduleSave(rule, { channel: c })}
                        className={
                          rule.channel === c
                            ? 'min-h-9 rounded-[6px] bg-primary px-3 text-sm font-medium text-white'
                            : 'min-h-9 rounded-[6px] px-3 text-sm font-medium text-slate-600 hover:bg-slate-100'
                        }
                      >
                        {c === 'web_push' ? 'Push' : c === 'email' ? 'Email' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
