import {
  LAYER_LABELS,
  buildNotificationSummary,
  isSevereWeatherAlert,
  type EventType,
  type LocationLayer,
  type NearbyHazardEvent,
  type NotificationLayerType,
  type NotificationRule,
  type TypedSupabaseClient,
  type WatchLocation,
} from '@allclear/shared';
import type { WorkerConfig } from '../config';
import { log, errorFields } from '../logger';
import { sendEmail, emailEnabled } from './email';
import { loadSubscriptions, pushEnabled, sendPush } from './push';
import { selectCandidates, type PriorNotification } from './select';

interface RuleWithLocation extends NotificationRule {
  watch_locations: (WatchLocation & { location_layers: LocationLayer[] }) | null;
}

type EventRow = Omit<NearbyHazardEvent, 'attributes' | 'event_type'> & { attributes: unknown; event_type: string };

function toEvent(row: EventRow): NearbyHazardEvent {
  return {
    ...row,
    event_type: row.event_type as EventType,
    attributes: (row.attributes && typeof row.attributes === 'object' ? row.attributes : {}) as Record<string, unknown>,
  };
}

async function eventsForRule(sb: TypedSupabaseClient, rule: RuleWithLocation): Promise<{ events: NearbyHazardEvent[]; radius: number | null }> {
  const loc = rule.watch_locations!;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const layer = (t: LocationLayer['layer_type']) => loc.location_layers.find((l) => l.layer_type === t);
  switch (rule.condition_type) {
    case 'distance_threshold_miles': {
      const radius = Number(rule.threshold_value ?? 25);
      const [points, polygons] = await Promise.all([
        sb.rpc('hazards_near', { p_lat: lat, p_lng: lng, p_radius_miles: radius, p_event_types: ['fire_hotspot', 'fire_incident'], p_limit: 500 }),
        sb.rpc('perimeters_near', { p_lat: lat, p_lng: lng, p_radius_miles: radius, p_event_types: ['fire_perimeter'], p_limit: 50 }),
      ]);
      if (points.error) throw new Error(points.error.message);
      if (polygons.error) throw new Error(polygons.error.message);
      const perimeterEvents = (polygons.data ?? []).map((r) =>
        toEvent({ ...r, description: null, latitude: null, longitude: null, magnitude: null, aqi: null }),
      );
      return { events: [...(points.data ?? []).map(toEvent), ...perimeterEvents], radius };
    }
    case 'magnitude_threshold': {
      const radius = Number(layer('earthquake')?.radius_miles ?? 100);
      const { data, error } = await sb.rpc('hazards_near', { p_lat: lat, p_lng: lng, p_radius_miles: radius, p_event_types: ['earthquake'], p_limit: 200 });
      if (error) throw new Error(error.message);
      return { events: (data ?? []).map(toEvent), radius };
    }
    case 'aqi_threshold': {
      const { data, error } = await sb.rpc('hazards_near', { p_lat: lat, p_lng: lng, p_radius_miles: 30, p_event_types: ['aqi_reading'], p_limit: 1 });
      if (error) throw new Error(error.message);
      return { events: (data ?? []).map(toEvent), radius: null };
    }
    case 'any_active': {
      const { data, error } = await sb.rpc('alerts_for_point', { p_lat: lat, p_lng: lng });
      if (error) throw new Error(error.message);
      const events = (data ?? []).map(toEvent);
      return { events: rule.layer_type === 'weather' ? events.filter(isSevereWeatherAlert) : events, radius: null };
    }
    default:
      return { events: [], radius: null };
  }
}

async function priorFor(sb: TypedSupabaseClient, ruleId: string): Promise<PriorNotification[]> {
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const { data, error } = await sb
    .from('notifications_log')
    .select('hazard_event_id, sent_at, cached_hazard_events(event_type)')
    .eq('notification_rule_id', ruleId)
    .gte('sent_at', since);
  if (error) throw new Error(`load notifications_log failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    hazard_event_id: row.hazard_event_id,
    sent_at: row.sent_at,
    event_type: row.cached_hazard_events?.event_type ?? null,
  }));
}

const emailCache = new Map<string, string | null>();
async function emailFor(sb: TypedSupabaseClient, userId: string): Promise<string | null> {
  if (emailCache.has(userId)) return emailCache.get(userId) ?? null;
  const { data, error } = await sb.auth.admin.getUserById(userId);
  const email = error ? null : (data.user?.email ?? null);
  emailCache.set(userId, email);
  return email;
}

/**
 * Evaluate every enabled rule for the given layers against the freshly ingested cache and deliver
 * notifications (Tech Spec §1.1). Called after each successful poller run.
 */
export async function evaluateRules(sb: TypedSupabaseClient, config: WorkerConfig, layers: NotificationLayerType[], now = new Date()): Promise<{ sent: number; evaluated: number }> {
  const { data, error } = await sb
    .from('notification_rules')
    .select('*, watch_locations(*, location_layers(*))')
    .eq('enabled', true)
    .in('layer_type', layers);
  if (error) throw new Error(`load notification_rules failed: ${error.message}`);
  const rules = (data ?? []) as unknown as RuleWithLocation[];
  let sent = 0;
  let evaluated = 0;

  for (const rule of rules) {
    const location = rule.watch_locations;
    if (!location) continue;
    evaluated += 1;
    try {
      const { events, radius } = await eventsForRule(sb, rule);
      if (events.length === 0) continue;
      const prior = await priorFor(sb, rule.id);
      const candidates = selectCandidates(rule, events, prior, radius, now);
      for (const candidate of candidates) {
        let summary = buildNotificationSummary(rule, candidate.event, location.label);
        if (candidate.hotspotCount && candidate.hotspotCount > 1) {
          summary = `${candidate.hotspotCount} new wildfire hotspots detected within ${Math.round(Number(rule.threshold_value ?? 25))} mi of ${location.label} (nearest ${Math.round(candidate.event.distance_miles)} mi)`;
        }
        const url = `${config.APP_URL.replace(/\/$/, '')}/dashboard/${location.id}`;
        const wantsPush = rule.channel === 'web_push' || rule.channel === 'both';
        const wantsEmail = rule.channel === 'email' || rule.channel === 'both';
        const delivered: Array<'web_push' | 'email'> = [];

        let pushed = 0;
        if (wantsPush && pushEnabled(config)) {
          const subs = await loadSubscriptions(sb, location.user_id);
          pushed = await sendPush(sb, config, subs, { title: `AllClear · ${LAYER_LABELS[rule.layer_type]}`, body: summary, url, tag: `rule-${rule.id}` });
          if (pushed > 0) delivered.push('web_push');
        }
        // Email is the fallback when push was requested but couldn't be delivered (no subscription).
        if ((wantsEmail || (wantsPush && pushed === 0)) && emailEnabled(config)) {
          const email = await emailFor(sb, location.user_id);
          if (email && (await sendEmail(config, email, `AllClear: ${summary}`, summary, url))) delivered.push('email');
        }
        if (delivered.length === 0) {
          // Nothing configured for delivery yet — still record it so the in-app history shows it once.
          delivered.push(wantsEmail ? 'email' : 'web_push');
          log.warn('notification recorded but no delivery channel configured', { rule: rule.id });
        }
        for (const channel of delivered) {
          const { error: logErr } = await sb.from('notifications_log').insert({
            user_id: location.user_id,
            watch_location_id: location.id,
            notification_rule_id: rule.id,
            hazard_event_id: candidate.event.id,
            layer_type: rule.layer_type,
            summary,
            channel,
            sent_at: now.toISOString(),
          });
          if (logErr) log.warn('notifications_log insert failed', { rule: rule.id, error: logErr.message });
        }
        sent += 1;
        log.info('notification sent', { rule: rule.id, layer: rule.layer_type, channels: delivered, summary });
      }
    } catch (error) {
      log.error('rule evaluation failed', { rule: rule.id, ...errorFields(error) });
    }
  }
  return { sent, evaluated };
}
