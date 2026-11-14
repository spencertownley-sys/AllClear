import { Resend } from 'resend';
import { unsubscribeUrl } from '@nimbuswatch/shared/unsubscribe';
import type { WorkerConfig } from '../config';
import { log, errorFields } from '../logger';

let client: Resend | null = null;
let warnedMissingFooterConfig = false;

export function emailEnabled(config: WorkerConfig): boolean {
  return Boolean(config.RESEND_API_KEY && config.RESEND_FROM);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Same wording as the web app's SafetyDisclaimer (apps/web/src/components/ui/safety-disclaimer.tsx). */
export const EMAIL_DISCLAIMER =
  'NimbusWatch relays public data from NWS, NASA FIRMS, USGS, AirNow and NIFC. It is not an emergency alert system and is not for life-safety decisions. Data can be delayed, incomplete or wrong, and notifications can fail. In an emergency call 911 and follow instructions from local officials, Wireless Emergency Alerts and NOAA Weather Radio.';

export interface EmailParts {
  /** The alert text. */
  body: string;
  /** Deep link to the location in the app. */
  url: string;
  /** Signed one-click unsubscribe link for this rule, when UNSUBSCRIBE_SECRET is configured. */
  unsubscribeUrl: string | null;
  /** Settings page where every rule can be changed (needs a login). */
  manageUrl: string;
  /** Sender's postal address (CAN-SPAM), when MAIL_POSTAL_ADDRESS is configured. */
  postalAddress: string | null;
}

/**
 * Text, HTML and headers for one alert email (NW-10): unsubscribe link and RFC 8058 one-click
 * headers, a link to manage notifications, the postal address and the safety disclaimer.
 */
export function buildEmail(parts: EmailParts): { text: string; html: string; headers: Record<string, string> } {
  const footerText = [
    parts.unsubscribeUrl ? `Stop emails for this alert rule: ${parts.unsubscribeUrl}` : null,
    `Manage notifications: ${parts.manageUrl}`,
    parts.postalAddress,
    EMAIL_DISCLAIMER,
  ]
    .filter(Boolean)
    .join('\n');
  const small = 'font:12px/1.5 system-ui,sans-serif;color:#64748b';
  const link = 'color:#0f6b66';
  const footerLinks = [
    parts.unsubscribeUrl ? `<a href="${escapeHtml(parts.unsubscribeUrl)}" style="${link}">Unsubscribe from this alert rule</a>` : null,
    `<a href="${escapeHtml(parts.manageUrl)}" style="${link}">Manage notifications</a>`,
  ]
    .filter(Boolean)
    .join(' · ');
  const html = [
    `<p style="font:16px/1.5 system-ui,sans-serif;color:#0f172a">${escapeHtml(parts.body)}</p>`,
    `<p><a href="${escapeHtml(parts.url)}" style="font:14px system-ui,sans-serif;${link}">Open NimbusWatch</a></p>`,
    `<p style="${small}">${footerLinks}</p>`,
    parts.postalAddress ? `<p style="${small}">${escapeHtml(parts.postalAddress)}</p>` : '',
    `<p style="${small}">${escapeHtml(EMAIL_DISCLAIMER)}</p>`,
  ].join('');
  const headers: Record<string, string> = parts.unsubscribeUrl
    ? { 'List-Unsubscribe': `<${parts.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : {};
  return { text: `${parts.body}\n\nOpen NimbusWatch: ${parts.url}\n\n${footerText}`, html, headers };
}

export async function sendEmail(
  config: WorkerConfig,
  to: string,
  subject: string,
  body: string,
  url: string,
  ruleId: string,
): Promise<boolean> {
  if (!emailEnabled(config)) return false;
  if (!client) client = new Resend(config.RESEND_API_KEY);
  const appUrl = config.APP_URL.replace(/\/$/, '');
  if (!warnedMissingFooterConfig && (!config.UNSUBSCRIBE_SECRET || !config.MAIL_POSTAL_ADDRESS)) {
    warnedMissingFooterConfig = true;
    log.warn('alert emails are missing a one-click unsubscribe link or postal address', {
      unsubscribeSecret: Boolean(config.UNSUBSCRIBE_SECRET),
      postalAddress: Boolean(config.MAIL_POSTAL_ADDRESS),
    });
  }
  const { text, html, headers } = buildEmail({
    body,
    url,
    unsubscribeUrl: config.UNSUBSCRIBE_SECRET ? unsubscribeUrl(appUrl, ruleId, config.UNSUBSCRIBE_SECRET) : null,
    manageUrl: `${appUrl}/settings/notifications`,
    postalAddress: config.MAIL_POSTAL_ADDRESS ?? null,
  });
  try {
    const { error } = await client.emails.send({ from: config.RESEND_FROM!, to, subject, text, html, headers });
    if (error) {
      log.warn('email send failed', { to, error: error.message });
      return false;
    }
    return true;
  } catch (error) {
    log.warn('email send threw', { to, ...errorFields(error) });
    return false;
  }
}
