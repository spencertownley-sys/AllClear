import http from 'node:http';
import type { Scheduler } from './scheduler';
import { log } from './logger';

/**
 * Tiny HTTP endpoint for Railway health checks / uptime monitoring (Launch Checklist: Monitoring).
 * GET /health → 200 when every enabled poller has succeeded recently, 503 otherwise.
 */
export function startHealthServer(port: number, scheduler: Scheduler | null, notConfiguredReason?: string): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      // Liveness only: the process is up (used by Railway's deploy healthcheck).
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alive: true, configured: Boolean(scheduler) }));
      return;
    }
    if (req.url === '/health') {
      // Readiness: every enabled poller has succeeded recently.
      if (!scheduler) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, configured: false, reason: notConfiguredReason ?? 'not configured' }));
        return;
      }
      const status = scheduler.status();
      res.writeHead(status.ok ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AllClear worker\n');
  });
  server.listen(port, () => log.info('health server listening', { port }));
  return server;
}
