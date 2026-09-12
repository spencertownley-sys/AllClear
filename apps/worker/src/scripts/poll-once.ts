import 'dotenv/config';
import { loadConfig } from '../config';
import { db } from '../db';
import { log } from '../logger';
import { pollers } from '../pollers';
import { Scheduler } from '../scheduler';

/** Run a single poller once, e.g. `pnpm --filter @allclear/worker poll usgs`. */
const name = process.argv[2];
const poller = pollers.find((p) => p.name === name);
if (!poller) {
  console.error(`Unknown poller "${name ?? ''}". Choose one of: ${pollers.map((p) => p.name).join(', ')}`);
  process.exit(1);
}
const config = loadConfig();
const scheduler = new Scheduler(db(config), config);
scheduler
  .runOnce(poller)
  .then(() => {
    log.info('poll-once finished', { source: poller.name });
    process.exit(0);
  })
  .catch((error) => {
    log.error('poll-once failed', { error: String(error) });
    process.exit(1);
  });
