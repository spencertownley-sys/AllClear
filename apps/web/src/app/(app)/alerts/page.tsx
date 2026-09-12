import type { Metadata } from 'next';
import Link from 'next/link';
import { BellOff, Mail, Smartphone } from 'lucide-react';
import { LAYER_LABELS, paginationSchema, type NotificationHistoryItemDTO } from '@allclear/shared';
import { createClient } from '@/lib/supabase/server';
import { listNotifications } from '@/lib/data/notifications';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Alerts' };

function groupByDay(items: NotificationHistoryItemDTO[]): Array<{ day: string; items: NotificationHistoryItemDTO[] }> {
  const groups = new Map<string, NotificationHistoryItemDTO[]>();
  for (const item of items) {
    const day = new Date(item.sent_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const list = groups.get(day) ?? [];
    list.push(item);
    groups.set(day, list);
  }
  return Array.from(groups, ([day, items]) => ({ day, items }));
}

/** Notification History: reverse-chronological, grouped by day (UI/UX Notes §3 "Alerts"). */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = paginationSchema.safeParse({ page: params.page, limit: 25 });
  const page = parsed.success ? parsed.data.page : 1;
  const limit = 25;
  const supabase = await createClient();
  const { data, meta } = await listNotifications(supabase, page, limit);
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));

  return (
    <>
      <PageHeader title="Alerts" description="Everything we've notified you about, newest first." />
      {data.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-8 w-8" aria-hidden />}
          title="No alerts yet"
          description="You'll see them here once one of your notification rules is triggered."
          action={
            <Button variant="outline" asChild>
              <Link href="/settings/notifications">Set up notification rules</Link>
            </Button>
          }
          className="py-16"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groupByDay(data).map((group) => (
            <section key={group.day} aria-labelledby={`day-${group.day}`}>
              <h2 id={`day-${group.day}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.day}
              </h2>
              <ul className="divide-y divide-slate-200 rounded-card border border-slate-200 bg-white">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-slate-400" aria-label={item.channel === 'email' ? 'Sent by email' : 'Sent by push'}>
                      {item.channel === 'email' ? <Mail className="h-4 w-4" aria-hidden /> : <Smartphone className="h-4 w-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900">{item.summary}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.watch_location_label}
                        {item.layer_type ? ` · ${LAYER_LABELS[item.layer_type]}` : ''} · {formatDateTime(item.sent_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {totalPages > 1 ? (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/alerts?page=${page - 1}`}>Newer</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/alerts?page=${page + 1}`}>Older</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      )}
    </>
  );
}
