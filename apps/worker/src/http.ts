import { log } from './logger';

const REDACTED = '[redacted]';
/** Query parameters that carry credentials in the APIs we poll (AirNow uses API_KEY). */
const SECRET_PARAM = /([?&](?:api_key|apikey|key|token|access_token)=)[^&#]*/gi;

/** The API keys that may appear inside a request URL (FIRMS puts its key in the path). */
function configuredSecrets(): string[] {
  return [process.env.NASA_FIRMS_MAP_KEY, process.env.AIRNOW_API_KEY].filter(
    (v): v is string => typeof v === 'string' && v.length >= 4,
  );
}

/**
 * Strip API keys from text that may end up in logs, Sentry, poller_runs.error or /health (CLAUDE.md rule 7).
 * Replaces any configured key wherever it appears (raw or URL-encoded) and any credential-named query value.
 */
export function redactSecrets(text: string, secrets: string[] = configuredSecrets()): string {
  let out = text;
  for (const secret of secrets) {
    out = out.split(secret).join(REDACTED);
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) out = out.split(encoded).join(REDACTED);
  }
  return out.replace(SECRET_PARAM, `$1${REDACTED}`);
}

/** A URL that is safe to log: same as redactSecrets, named for intent at call sites. */
export function redactUrl(url: string, secrets?: string[]): string {
  return redactSecrets(url, secrets);
}

export class HttpError extends Error {
  public readonly url: string;
  public readonly body: string;
  constructor(
    public readonly status: number,
    url: string,
    body: string,
    secrets?: string[],
  ) {
    const safeUrl = redactUrl(url, secrets);
    const safeBody = redactSecrets(body.slice(0, 200), secrets);
    super(`HTTP ${status} from ${safeUrl}: ${safeBody}`);
    this.name = 'HttpError';
    this.url = safeUrl;
    this.body = redactSecrets(body, secrets);
  }
}

interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Delay before first retry; doubles each attempt. */
  backoffMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retriable(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/** fetch with timeout + exponential backoff on 429/5xx/network failures. */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { headers = {}, timeoutMs = 20_000, retries = 2, backoffMs = 1_500 } = opts;
  let attempt = 0;
  for (;;) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
      if (!res.ok) {
        if (retriable(res.status) && attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs * 2 ** attempt;
          log.warn('http retry', { url: redactUrl(url), status: res.status, attempt, wait });
          await sleep(wait);
          attempt += 1;
          continue;
        }
        throw new HttpError(res.status, url, body);
      }
      return body;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (attempt < retries) {
        const wait = backoffMs * 2 ** attempt;
        log.warn('http retry after network error', { url: redactUrl(url), attempt, wait, error: redactSecrets((error as Error).message) });
        await sleep(wait);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(redactSecrets(`Expected JSON from ${url} but got: ${text.slice(0, 120)}`));
  }
}
