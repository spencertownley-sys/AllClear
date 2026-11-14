import { describe, expect, it } from 'vitest';
import { RECOVERY_WINDOW_MS, isRecentRecoverySession } from './recovery-session';

function token(amr: unknown): string {
  const body = Buffer.from(JSON.stringify({ sub: 'u', amr })).toString('base64url');
  return `header.${body}.signature`;
}

describe('isRecentRecoverySession', () => {
  const now = 1_800_000_000_000;
  const seconds = now / 1000;

  it('is true right after a password-reset link', () => {
    expect(isRecentRecoverySession(token([{ method: 'recovery', timestamp: seconds - 60 }]), now)).toBe(true);
  });

  it('is false for a normal password login or an old recovery', () => {
    expect(isRecentRecoverySession(token([{ method: 'password', timestamp: seconds }]), now)).toBe(false);
    expect(isRecentRecoverySession(token([{ method: 'recovery', timestamp: seconds - RECOVERY_WINDOW_MS / 1000 - 1 }]), now)).toBe(false);
  });

  it('is false for missing or malformed tokens', () => {
    expect(isRecentRecoverySession(null, now)).toBe(false);
    expect(isRecentRecoverySession('not-a-jwt', now)).toBe(false);
    expect(isRecentRecoverySession('a.%%%.c', now)).toBe(false);
  });
});
