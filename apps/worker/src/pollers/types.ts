import type { TypedSupabaseClient } from '@allclear/shared';
import type { WorkerConfig } from '../config';

export interface PollerContext {
  config: WorkerConfig;
  sb: TypedSupabaseClient;
  now: Date;
}

export interface PollerResult {
  rows: number;
  details?: Record<string, unknown>;
}

export interface Poller {
  /** Value stored in poller_runs.source. */
  name: string;
  /** Which hazard layers this poller feeds — drives rule evaluation after a successful run. */
  layers: Array<'weather' | 'wildfire' | 'earthquake' | 'air_quality' | 'official_alerts'>;
  intervalMinutes: (config: WorkerConfig) => number;
  /** Return a reason string when the poller can't run (missing key); null when enabled. */
  disabledReason: (config: WorkerConfig) => string | null;
  run: (ctx: PollerContext) => Promise<PollerResult>;
}
