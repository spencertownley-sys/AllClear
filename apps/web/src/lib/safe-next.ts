/**
 * Any fixed origin works as the base: we only check that resolving `value` against it stays on it,
 * which is true for the real origin exactly when it is true for this one. Using a constant keeps the
 * function pure and safe to call during server rendering.
 */
const BASE = 'https://nimbuswatch.invalid';

/**
 * A same-site path to send the user to after login, or '' when `next` is missing or unsafe (NW-13).
 * Rejects protocol-relative URLs ('//evil.com'), backslash tricks ('/\evil.com', which browsers treat
 * like '//evil.com') and anything else that would resolve to another origin.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.includes('\\')) return '';
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return '';
    return `${url.pathname}${url.search}`;
  } catch {
    return '';
  }
}
