import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, ChevronRight, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  const items = [
    {
      href: '/settings/notifications',
      icon: Bell,
      title: 'Notification settings',
      body: 'Per-location thresholds for fires, quakes, air quality and official alerts. Push and email delivery.',
    },
    {
      href: '/settings/account',
      icon: UserCog,
      title: 'Account',
      body: 'Your email, password, saved locations and account deletion.',
    },
  ];
  return (
    <>
      <PageHeader title="Settings" />
      <ul className="flex flex-col gap-3">
        {items.map(({ href, icon: Icon, title, body }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4 hover:shadow-md">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{title}</span>
                <span className="block text-sm text-slate-500">{body}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
