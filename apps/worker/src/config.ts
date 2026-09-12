import { z } from 'zod';

const minutes = (fallback: number) => z.coerce.number().positive().default(fallback);

const schema = z.object({
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NASA_FIRMS_MAP_KEY: z.string().optional(),
  AIRNOW_API_KEY: z.string().optional(),
  NWS_USER_AGENT: z.string().min(1).default('(AllClear worker, unknown-contact)'),
  NIFC_INCIDENTS_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  APP_URL: z.string().default('http://localhost:3000'),
  SENTRY_DSN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(8080),
  POLL_USGS_MINUTES: minutes(2),
  POLL_FIRMS_MINUTES: minutes(15),
  POLL_NWS_ALERTS_MINUTES: minutes(10),
  POLL_NWS_WEATHER_MINUTES: minutes(15),
  POLL_AIRNOW_MINUTES: minutes(30),
  POLL_NIFC_MINUTES: minutes(20),
  POLL_NIFC_PERIMETERS_MINUTES: minutes(20),
  POLL_NIFC_HISTORY_MINUTES: minutes(1440),
  POLL_NHC_MINUTES: minutes(30),
  POLL_EPA_UV_MINUTES: minutes(360),
  NIFC_PERIMETERS_URL: z.string().optional(),
  NIFC_HISTORY_URL: z.string().optional(),
  /** Bounding box polled from FIRMS: US incl. Alaska, Hawaii and Puerto Rico. */
  FIRMS_BBOX: z.string().default('-170,15,-60,72'),
  /** Safety cap on per-cell external calls in one run (AirNow free tier is ~500 req/hour). */
  MAX_CELLS_PER_RUN: z.coerce.number().int().positive().default(400),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const result = schema.safeParse({
    ...env,
    SUPABASE_URL: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    APP_URL: env.APP_URL ?? env.NEXT_PUBLIC_APP_URL,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY ?? env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!result.success) {
    const missing = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Worker configuration is invalid — ${missing}. See .env.example.`);
  }
  return result.data;
}
