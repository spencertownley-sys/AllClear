import { Resend } from 'resend';
import type { WorkerConfig } from '../config';
import { log, errorFields } from '../logger';

let client: Resend | null = null;

export function emailEnabled(config: WorkerConfig): boolean {
  return Boolean(config.RESEND_API_KEY && config.RESEND_FROM);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendEmail(
  config: WorkerConfig,
  to: string,
  subject: string,
  body: string,
  url: string,
): Promise<boolean> {
  if (!emailEnabled(config)) return false;
  if (!client) client = new Resend(config.RESEND_API_KEY);
  try {
    const { error } = await client.emails.send({
      from: config.RESEND_FROM!,
      to,
      subject,
      text: `${body}\n\nOpen AllClear: ${url}\n\nAllClear relays public data from NWS, NASA FIRMS, USGS, AirNow and NIFC. It is not an official emergency notification system.`,
      html: `<p style="font:16px/1.5 system-ui,sans-serif;color:#0f172a">${escapeHtml(body)}</p><p><a href="${url}" style="font:14px system-ui,sans-serif;color:#0f6b66">Open AllClear</a></p><p style="font:12px system-ui,sans-serif;color:#64748b">AllClear relays public data from NWS, NASA FIRMS, USGS, AirNow and NIFC. It is not an official emergency notification system.</p>`,
    });
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
