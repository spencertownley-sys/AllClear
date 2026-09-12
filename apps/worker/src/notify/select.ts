import { DEFAULT_MIN_INTERVAL_MINUTES, eventMatchesRule, type NearbyHazardEvent, type NotificationRule } from '@allclear/shared';

export interface PriorNotification {
  hazard_event_id: string | null;
  sent_at: string;
  event_type: string | null;
}

export interface Candidate {
  event: NearbyHazardEvent;
  /** When true, this is a roll-up of several hotspots; `event` is the nearest one. */
  hotspotCount?: number;
}

const QUAKE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** The rule's own frequency setting, falling back to the per-condition default. */
export function minIntervalMs(rule: Pick<NotificationRule, 'condition_type' | 'min_interval_minutes'>): number {
  const minutes = rule.min_interval_minutes ?? DEFAULT_MIN_INTERVAL_MINUTES[rule.condition_type];
  return minutes ? minutes * 60_000 : 0;
}

/**
 * Pure selection of what to notify for one rule this run. Enforces:
 *  - per-event de-duplication against notifications_log
 *  - cooldowns (AQI: 6h; hotspot roll-ups: 6h) so a big fire doesn't produce hundreds of pushes
 *  - "newness" windows so creating a rule doesn't replay a week of quakes
 */
export function selectCandidates(
  rule: NotificationRule,
  events: NearbyHazardEvent[],
  prior: PriorNotification[],
  radiusMiles: number | null,
  now: Date,
): Candidate[] {
  const notified = new Set(prior.map((p) => p.hazard_event_id).filter((id): id is string => Boolean(id)));
  const lastSentAt = prior.reduce<number>((acc, p) => Math.max(acc, Date.parse(p.sent_at) || 0), 0);
  const matching = events.filter((e) =>
    eventMatchesRule(rule, e, { distanceMiles: e.distance_miles, radiusMiles }),
  );
  const interval = minIntervalMs(rule);
  // A user-chosen frequency ("every 6 hours", "once a day") caps every rule type.
  if (rule.min_interval_minutes && now.getTime() - lastSentAt < interval) return [];

  switch (rule.condition_type) {
    case 'aqi_threshold': {
      const reading = matching[0];
      if (!reading) return [];
      if (now.getTime() - lastSentAt < interval) return [];
      return [{ event: reading }];
    }
    case 'magnitude_threshold':
      return matching
        .filter((e) => !notified.has(e.id))
        .filter((e) => e.occurred_at !== null && now.getTime() - Date.parse(e.occurred_at) <= QUAKE_LOOKBACK_MS)
        .map((event) => ({ event }));
    case 'any_active':
      return matching.filter((e) => !notified.has(e.id)).map((event) => ({ event }));
    case 'distance_threshold_miles': {
      const incidents = matching
        .filter((e) => (e.event_type === 'fire_incident' || e.event_type === 'fire_perimeter') && !notified.has(e.id))
        .map((event) => ({ event }));
      const lastHotspotAt = prior
        .filter((p) => p.event_type === 'fire_hotspot')
        .reduce<number>((acc, p) => Math.max(acc, Date.parse(p.sent_at) || 0), 0);
      const cutoff = lastHotspotAt > 0 ? lastHotspotAt : now.getTime() - 24 * 60 * 60 * 1000;
      const fresh = matching.filter(
        (e) => e.event_type === 'fire_hotspot' && e.occurred_at !== null && Date.parse(e.occurred_at) > cutoff,
      );
      if (fresh.length === 0 || now.getTime() - lastHotspotAt < interval) return incidents;
      const nearest = fresh.reduce((a, b) => (b.distance_miles < a.distance_miles ? b : a));
      return [...incidents, { event: nearest, hotspotCount: fresh.length }];
    }
    default:
      return [];
  }
}
