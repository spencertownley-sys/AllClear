import * as Sentry from '@sentry/node';
import type { TypedSupabaseClient } from '@allclear/shared';
import type { WorkerConfig } from './config';
import { deleteExpired, recordRunEnd, recordRunStart } from './db';
import { log, errorFields } from './logger';
import { evaluateRules } from './notify/evaluate';
import { pollers, type Poller } from './pollers';

interface JobState {
  poller: Poller;
  running: boolean;
  lastSuccessAt: Date | null;
  lastError: string | null;
  timer: NodeJS.Timeout | null;
}

export class Scheduler {
  private readonly jobs: JobState[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sb: TypedSupabaseClient,
    private readonly config: WorkerConfig,
  ) {}

  /** Run one poller end-to-end: heartbeat row, ingest, rule evaluation. */
  async runOnce(poller: Poller): Promise<void> {
    const disabled = poller.disabledReason(this.config);
    if (disabled) {
      log.warn('poller disabled', { source: poller.name, reason: disabled });
      return;
    }
    const state = this.jobs.find((j) => j.poller === poller);
    if (state?.running) {
      log.warn('poller still running; skipping tick', { source: poller.name });
      return;
    }
    if (state) state.running = true;
    const startedAt = Date.now();
    const runId = await recordRunStart(this.sb, poller.name);
    try {
      const result = await poller.run({ config: this.config, sb: this.sb, now: new Date() });
      await recordRunEnd(this.sb, runId, { status: 'success', rows_upserted: result.rows, details: { ...result.details, ms: Date.now() - startedAt } });
      if (state) {
        state.lastSuccessAt = new Date();
        state.lastError = null;
      }
      log.info('poller run ok', { source: poller.name, rows: result.rows, ms: Date.now() - startedAt, ...result.details });
      try {
        const outcome = await evaluateRules(this.sb, this.config, poller.layers);
        if (outcome.evaluated > 0) log.info('rules evaluated', { source: poller.name, ...outcome });
      } catch (error) {
        log.error('rule evaluation crashed', { source: poller.name, ...errorFields(error) });
        Sentry.captureException(error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordRunEnd(this.sb, runId, { status: 'error', rows_upserted: 0, error: message.slice(0, 2000), details: { ms: Date.now() - startedAt } });
      if (state) state.lastError = message;
      log.error('poller run failed', { source: poller.name, ...errorFields(error) });
      Sentry.captureException(error, { tags: { poller: poller.name } });
    } finally {
      if (state) state.running = false;
    }
  }

  start(): void {
    pollers.forEach((poller, index) => {
      const state: JobState = { poller, running: false, lastSuccessAt: null, lastError: null, timer: null };
      this.jobs.push(state);
      const intervalMs = poller.intervalMinutes(this.config) * 60_000;
      const disabled = poller.disabledReason(this.config);
      if (disabled) {
        log.warn('poller disabled', { source: poller.name, reason: disabled });
        return;
      }
      // Stagger initial runs a few seconds apart so startup doesn't burst every external API at once.
      setTimeout(() => void this.runOnce(poller), 2_000 + index * 4_000);
      state.timer = setInterval(() => void this.runOnce(poller), intervalMs);
      log.info('poller scheduled', { source: poller.name, everyMinutes: poller.intervalMinutes(this.config) });
    });
    this.cleanupTimer = setInterval(() => void deleteExpired(this.sb, 7), 60 * 60_000);
  }

  stop(): void {
    for (const job of this.jobs) if (job.timer) clearInterval(job.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /** Health view: a source is unhealthy when its last success is older than 3× its interval. */
  status(now = Date.now()): { ok: boolean; sources: Array<{ source: string; enabled: boolean; lastSuccessAt: string | null; lastError: string | null; healthy: boolean }> } {
    const sources = this.jobs.map((job) => {
      const disabled = job.poller.disabledReason(this.config);
      const intervalMs = job.poller.intervalMinutes(this.config) * 60_000;
      const graceMs = Math.max(3 * intervalMs, 10 * 60_000);
      const healthy = disabled ? true : job.lastSuccessAt !== null ? now - job.lastSuccessAt.getTime() <= graceMs : now - startedAt <= graceMs;
      return { source: job.poller.name, enabled: !disabled, lastSuccessAt: job.lastSuccessAt?.toISOString() ?? null, lastError: job.lastError, healthy };
    });
    return { ok: sources.every((s) => s.healthy), sources };
  }
}

const startedAt = Date.now();
