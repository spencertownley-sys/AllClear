import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { loadConfig } from './config';
import { db } from './db';
import { startHealthServer } from './health';
import { log } from './logger';
import { Scheduler } from './scheduler';

const config = loadConfig();

if (config.SENTRY_DSN) {
  Sentry.init({ dsn: config.SENTRY_DSN, environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV, tracesSampleRate: 0.05 });
}

let scheduler: Scheduler | null = null;
let server: ReturnType<typeof startHealthServer>;

if (config.SUPABASE_SERVICE_ROLE_KEY) {
  scheduler = new Scheduler(db(config), config);
  server = startHealthServer(config.PORT, scheduler);
  scheduler.start();
  log.info('worker started', { appUrl: config.APP_URL });
} else {
  // Stay up with a clear status instead of crash-looping: /health reports 503 until the key is set.
  const reason = 'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to the service variables (Supabase → Project Settings → API) to start polling.';
  server = startHealthServer(config.PORT, null, reason);
  log.error('worker idle: not configured', { reason });
}

function shutdown(signal: string) {
  log.info('shutting down', { signal });
  scheduler?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { reason: String(reason) });
  Sentry.captureException(reason);
});
