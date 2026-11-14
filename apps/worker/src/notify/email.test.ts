import { describe, expect, it } from 'vitest';
import { buildEmail, EMAIL_DISCLAIMER } from './email';
import { channelsFor } from './evaluate';

const base = {
  body: 'Wildfire detected 12 mi from Home',
  url: 'https://app.test/dashboard/abc',
  manageUrl: 'https://app.test/settings/notifications',
};

describe('buildEmail', () => {
  it('includes the unsubscribe link, one-click headers, postal address and disclaimer', () => {
    const unsubscribeUrl = 'https://app.test/api/notifications/unsubscribe?t=rule.sig';
    const email = buildEmail({ ...base, unsubscribeUrl, postalAddress: 'PO Box 1, Bend, OR 97701' });
    expect(email.headers).toEqual({
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    for (const part of [email.text, email.html]) {
      expect(part).toContain(unsubscribeUrl);
      expect(part).toContain(base.manageUrl);
      expect(part).toContain('PO Box 1, Bend, OR 97701');
      expect(part).toContain(EMAIL_DISCLAIMER);
    }
  });

  it('still links to notification settings when no unsubscribe secret is configured', () => {
    const email = buildEmail({ ...base, unsubscribeUrl: null, postalAddress: null });
    expect(email.headers).toEqual({});
    expect(email.text).toContain(base.manageUrl);
    expect(email.html).toContain('Manage notifications');
  });

  it('escapes the alert text in HTML', () => {
    const email = buildEmail({ ...base, body: '<script>x</script>', unsubscribeUrl: null, postalAddress: null });
    expect(email.html).not.toContain('<script>');
  });
});

describe('channelsFor', () => {
  it('never emails a push-only rule', () => {
    expect(channelsFor('web_push')).toEqual({ push: true, email: false });
    expect(channelsFor('email')).toEqual({ push: false, email: true });
    expect(channelsFor('both')).toEqual({ push: true, email: true });
  });
});
