import { ApiError } from '@nimbuswatch/shared';
import { unsubscribeTokenSchema } from '@nimbuswatch/shared/unsubscribe';
import { parseSearchParams } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { disableEmailForRule, ruleIdFromToken } from '@/lib/data/unsubscribe';

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

/**
 * GET never changes anything (mail scanners and link previewers follow links): it sends the browser
 * to the confirm page, whose button POSTs back here.
 */
export const GET = withErrorHandling(async (request) => {
  const { t } = parseSearchParams(request, unsubscribeTokenSchema);
  return seeOther(`/unsubscribe?t=${encodeURIComponent(t)}`);
});

/**
 * Turns off email for the rule in the signed token. Handles both RFC 8058 one-click POSTs from mail
 * clients (body "List-Unsubscribe=One-Click", answered with 200) and the confirm page's form
 * (field "from=page", answered with a redirect to the confirmation).
 */
export const POST = withErrorHandling(async (request) => {
  const { t } = parseSearchParams(request, unsubscribeTokenSchema);
  const ruleId = ruleIdFromToken(t);
  if (!ruleId) throw new ApiError('VALIDATION_ERROR', 'This unsubscribe link is not valid.');
  await disableEmailForRule(ruleId);

  let fromPage = false;
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    fromPage = form?.get('from') === 'page';
  }
  if (fromPage) return seeOther('/unsubscribe?done=1');
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
});
