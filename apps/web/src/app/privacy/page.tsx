import type { Metadata } from 'next';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { SiteFooter } from '@/components/nav/site-footer';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default async function PrivacyPage() {
  const user = await getOptionalUser();
  return (
    <AppShell user={user ? { email: user.email ?? null } : null}>
      <article className="prose-sm max-w-2xl text-slate-700">
        <h1 className="text-2xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-1 text-xs text-slate-500">Last updated September 2026 · Draft — review before public launch.</p>
        <h2 className="mt-6 font-semibold text-slate-900">What we store</h2>
        <p className="mt-1">
          Your email address and password hash (managed by Supabase Auth); the Watch Locations you save, including their
          coordinates and the labels you give them; your layer and notification settings; a log of notifications we sent
          you; and, if you enable push notifications, the browser push endpoint for your device.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">What we do with location data</h2>
        <p className="mt-1">
          Location data is used only to look up hazard information near the places you save and to send you the
          notifications you configure. We never sell it, share it with advertisers, or use it for any other purpose.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">Third-party data sources</h2>
        <p className="mt-1">
          Hazard information comes from the National Weather Service, NASA FIRMS, the US Geological Survey, AirNow (EPA)
          and NIFC/InciWeb. Our servers fetch this data on your behalf — your browser never contacts these services
          directly. Location search uses OpenStreetMap Nominatim; your search text is sent to that service.
        </p>
        <h2 className="mt-6 font-semibold text-slate-900">Deleting your data</h2>
        <p className="mt-1">You can delete your account at any time from Settings → Account. This removes everything above.</p>
      </article>
      <SiteFooter />
    </AppShell>
  );
}
