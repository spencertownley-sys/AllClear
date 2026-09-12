import { z } from 'zod';
import {
  AQI_LIMITS,
  CHANNELS,
  CONDITION_TYPES,
  LAYER_TYPES,
  MAGNITUDE_LIMITS,
  NOTIFICATION_LAYER_TYPES,
  RADIUS_LIMITS,
  VALID_RULE_COMBOS,
  type ConditionType,
  type NotificationLayerType,
} from './constants';
import { parseBbox } from './geo';

export const latitudeSchema = z
  .number({ error: 'Latitude must be a number' })
  .min(-90, 'Must be between -90 and 90')
  .max(90, 'Must be between -90 and 90');

export const longitudeSchema = z
  .number({ error: 'Longitude must be a number' })
  .min(-180, 'Must be between -180 and 180')
  .max(180, 'Must be between -180 and 180');

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createLocationSchema = z.object({
  label: z.string().trim().min(1, 'Give this place a label').max(60, 'Keep labels under 60 characters'),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  city_name: optionalText(120),
  state: optionalText(60),
  postal_code: z.string().trim().min(3).max(12).nullable().optional(),
  country: z.string().trim().length(2, 'Use a 2-letter country code').toUpperCase().optional(),
  is_primary: z.boolean().optional(),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const layerConfigSchema = z.object({
  layer_type: z.enum(LAYER_TYPES),
  enabled: z.boolean(),
  radius_miles: z
    .number()
    .min(RADIUS_LIMITS.min, `Radius must be at least ${RADIUS_LIMITS.min} mile`)
    .max(RADIUS_LIMITS.max, `Radius must be at most ${RADIUS_LIMITS.max} miles`)
    .nullable()
    .optional(),
  min_magnitude: z
    .number()
    .min(MAGNITUDE_LIMITS.min)
    .max(MAGNITUDE_LIMITS.max)
    .nullable()
    .optional(),
});
export type LayerConfigInput = z.infer<typeof layerConfigSchema>;

export const layersPutSchema = z
  .array(layerConfigSchema)
  .min(1, 'Provide at least one layer')
  .max(LAYER_TYPES.length)
  .superRefine((layers, ctx) => {
    const seen = new Set<string>();
    layers.forEach((layer, index) => {
      if (seen.has(layer.layer_type)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'layer_type'],
          message: `Duplicate layer_type "${layer.layer_type}"`,
        });
      }
      seen.add(layer.layer_type);
    });
  });
export type LayersPutInput = z.infer<typeof layersPutSchema>;

interface ThresholdIssue {
  path: string[];
  message: string;
}

function thresholdIssues(
  layer: NotificationLayerType,
  condition: ConditionType,
  threshold: number | null | undefined,
): ThresholdIssue[] {
  const allowed = VALID_RULE_COMBOS[layer];
  if (!allowed.includes(condition)) {
    return [
      {
        path: ['condition_type'],
        message: `condition_type "${condition}" is not valid for layer "${layer}" (expected ${allowed.join(', ')})`,
      },
    ];
  }
  const needsThreshold = condition !== 'any_active';
  if (!needsThreshold) return [];
  if (threshold === null || threshold === undefined) {
    return [{ path: ['threshold_value'], message: 'threshold_value is required' }];
  }
  const limits =
    condition === 'distance_threshold_miles'
      ? RADIUS_LIMITS
      : condition === 'magnitude_threshold'
        ? MAGNITUDE_LIMITS
        : AQI_LIMITS;
  if (threshold < limits.min || threshold > limits.max) {
    return [
      {
        path: ['threshold_value'],
        message: `threshold_value must be between ${limits.min} and ${limits.max}`,
      },
    ];
  }
  return [];
}

/** Minimum minutes between notifications; null = every new event. */
const minIntervalSchema = z
  .number()
  .int()
  .min(15, 'At least 15 minutes')
  .max(10080, 'At most 7 days')
  .nullable()
  .optional();

export const createRuleSchema = z
  .object({
    layer_type: z.enum(NOTIFICATION_LAYER_TYPES),
    condition_type: z.enum(CONDITION_TYPES),
    threshold_value: z.number().nullable().optional(),
    channel: z.enum(CHANNELS).default('both'),
    enabled: z.boolean().default(true),
    min_interval_minutes: minIntervalSchema,
  })
  .superRefine((rule, ctx) => {
    for (const issue of thresholdIssues(rule.layer_type, rule.condition_type, rule.threshold_value)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
  .object({
    threshold_value: z.number().nullable().optional(),
    channel: z.enum(CHANNELS).optional(),
    enabled: z.boolean().optional(),
    min_interval_minutes: minIntervalSchema,
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

/** Validate an update against the rule's existing layer/condition (which cannot change). */
export function validateRuleUpdate(
  existing: { layer_type: NotificationLayerType; condition_type: ConditionType },
  update: UpdateRuleInput,
): { ok: true } | { ok: false; message: string } {
  if (update.threshold_value === undefined) return { ok: true };
  const first = thresholdIssues(existing.layer_type, existing.condition_type, update.threshold_value)[0];
  return first ? { ok: false, message: first.message } : { ok: true };
}

export const mapQuerySchema = z.object({
  bbox: z
    .string()
    .transform((value, ctx) => {
      const parsed = parseBbox(value);
      if (!parsed) {
        ctx.addIssue({ code: 'custom', message: 'bbox must be "minLng,minLat,maxLng,maxLat"' });
        return z.NEVER;
      }
      return parsed;
    }),
  layers: z
    .string()
    .optional()
    .transform((value) => {
      const requested = (value ?? 'fires,quakes,perimeters,storms')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return {
        fires: requested.includes('fires'),
        quakes: requested.includes('quakes'),
        perimeters: requested.includes('perimeters'),
        storms: requested.includes('storms'),
      };
    }),
});
export type MapQueryInput = z.infer<typeof mapQuerySchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  user_agent: z.string().max(512).optional(),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const geocodeSearchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(200),
});

export const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Convert a Zod error into the API's `details` array. */
export function zodIssuesToDetails(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || 'body',
    message: issue.message,
  }));
}
