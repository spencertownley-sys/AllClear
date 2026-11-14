/** How long after following a password-reset link the user may set a password without the old one. */
export const RECOVERY_WINDOW_MS = 30 * 60_000;

interface AmrEntry {
  method?: string;
  timestamp?: number;
}

/**
 * True when the Supabase access token says this session was started from a password-reset email
 * (amr method "recovery") within the last RECOVERY_WINDOW_MS. Those users can't know their current
 * password, so the account page lets them set a new one without it (NW-18).
 */
export function isRecentRecoverySession(accessToken: string | null | undefined, now = Date.now()): boolean {
  if (!accessToken) return false;
  const payload = accessToken.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { amr?: AmrEntry[] };
    return (json.amr ?? []).some(
      (entry) => entry.method === 'recovery' && typeof entry.timestamp === 'number' && now - entry.timestamp * 1000 <= RECOVERY_WINDOW_MS,
    );
  } catch {
    return false;
  }
}
