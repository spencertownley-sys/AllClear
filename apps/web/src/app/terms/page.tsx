import type { Metadata } from 'next';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { SiteFooter } from '@/components/nav/site-footer';

export const metadata: Metadata = { title: 'Terms of Service' };

export default async function TermsPage() {
  const user = await getOptionalUser();
  return (
    <AppShell user={user ? { email: user.email ?? null } : null}>
      <article className="max-w-2xl text-sm text-slate-700">
        <h1 className="text-2xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="mt-1 text-xs text-slate-500">Last updated September 2026 · Draft — review before public launch.</p>
        <h2 className="mt-6 font-semibold text-slate-900">Not an emergency service</h2>
        <p className="mt-1">
          AllClear relays publicly available hazard data as a convenience. It is not an official emergency notification
          system, data may be delayed, incomplete or wrong, and notifications may fail to arrive. Always follow guidance
          from local authorities and official alerting channels such as Wireless Emergency Alerts and NOAA Weather Radio.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">Acceptable use</h2>
        <p className="mt-1">
          Use AllClear for personal situational awareness. Don&apos;t scrape the service, overload the public map API, or
          attempt to access another person&apos;s data.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">Data sources and attribution</h2>
        <p className="mt-1">
          Data is provided by the National Weather Service, NASA FIRMS, USGS, AirNow and NIFC/InciWeb under their
          respective terms. Map tiles © OpenStreetMap contributors.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">Changes</h2>
        <p className="mt-1">We may update these terms; continued use after an update means you accept the new terms.</p>
      </article>
      <SiteFooter />
    </AppShell>
  );
}
