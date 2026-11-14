import { describe, expect, it } from 'vitest';
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from './unsubscribe';

const RULE = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
const SECRET = 'test-secret-0123456789abcdef';

describe('unsubscribe tokens', () => {
  it('round-trips a rule id', () => {
    const token = signUnsubscribeToken(RULE, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(RULE);
  });

  it('rejects a token signed with another secret, for another rule, or tampered with', () => {
    const token = signUnsubscribeToken(RULE, SECRET);
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull();
    const other = '00000000-0000-4000-8000-000000000000';
    expect(verifyUnsubscribeToken(`${other}.${token.split('.')[1]}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('garbage', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, '')).toBeNull();
  });

  it('builds the API link', () => {
    expect(unsubscribeUrl('https://app.test/', RULE, SECRET)).toBe(
      `https://app.test/api/notifications/unsubscribe?t=${signUnsubscribeToken(RULE, SECRET)}`,
    );
  });
});
