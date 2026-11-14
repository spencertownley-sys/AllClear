import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps same-site paths and their query', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('/settings/notifications?location=abc')).toBe('/settings/notifications?location=abc');
  });

  it.each(['/\\evil.com', '//evil.com', '/\t/evil.com', 'https://evil.com', 'evil.com', '/%5Cevil.com/../\\x', '', null])(
    'rejects %j',
    (value) => {
      expect(safeNext(value)).toBe('');
    },
  );

  it('treats an encoded backslash as a harmless path', () => {
    // /login?next=/%5Cevil.com arrives decoded as "/\evil.com" (rejected above); left encoded it stays on-site.
    expect(safeNext('/%5Cevil.com')).toBe('/%5Cevil.com');
  });
});
