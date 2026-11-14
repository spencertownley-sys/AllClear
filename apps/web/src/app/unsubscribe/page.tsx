import type { Metadata } from 'next';
import Link from 'next/link';
import { MailX } from 'lucide-react';
import { unsubscribeTokenSchema } from '@nimbuswatch/shared/unsubscribe';
import { Logo } from '@/components/nav/app-shell';
import { Button } from '@/components/ui/button';
import { ruleIdFromToken } from '@/lib/data/unsubscribe';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

/** Confirm page for the unsubscribe link in alert emails (NW-10). Works without signing in. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const done = params.done === '1';
  const token = typeof params.t === 'string' ? params.t : '';
  const valid = !done && unsubscribeTokenSchema.safeParse({ t: token }).success && ruleIdFromToken(token) !== null;

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-10">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
        <MailX className="mb-3 h-6 w-6 text-primary" aria-hidden />
        {done ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">You are unsubscribed</h1>
            <p className="mt-2">
              This alert rule will not send you email any more. Push notifications you turned on for it are unchanged.
            </p>
          </>
        ) : valid ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Stop emails for this alert rule?</h1>
            <p className="mt-2">
              You will stop getting email for this one rule. Your other rules, and any push notifications, stay as
              they are.
            </p>
            <form method="post" action={`/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`} className="mt-4">
              <input type="hidden" name="from" value="page" />
              <Button type="submit">Unsubscribe</Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">This link does not work</h1>
            <p className="mt-2">
              The unsubscribe link is incomplete or no longer valid. You can still change every alert from your
              notification settings.
            </p>
          </>
        )}
        <p className="mt-4">
          <Link href="/settings/notifications" className="text-primary underline underline-offset-2">
            Manage notifications
          </Link>
        </p>
      </div>
    </div>
  );
}
