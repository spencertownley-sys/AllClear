import { log } from './logger';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} from ${url}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
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
          log.warn('http retry', { url, status: res.status, attempt, wait });
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
        log.warn('http retry after network error', { url, attempt, wait, error: (error as Error).message });
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
    throw new Error(`Expected JSON from ${url} but got: ${text.slice(0, 120)}`);
  }
}
