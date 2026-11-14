import type { Metadata } from 'next';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { ContactEmail, LegalHeading, LegalTable, LegalTitle } from '@/components/legal/prose';

export const metadata: Metadata = { title: 'Cookie Policy', alternates: { canonical: '/cookies' } };

const TILE_RECEIVES = 'IP address, browser details, the map area viewed';

/** Keep in step with what the app actually stores and loads (map prefs, service worker, map hosts). */
const THIRD_PARTIES: Array<[string, string, string, string, string]> = [
  ['OpenStreetMap Foundation', 'tile.openstreetmap.org', 'Street map tiles', 'When the map shows the Street style (the default)', TILE_RECEIVES],
  ['US Geological Survey (The National Map)', 'basemap.nationalmap.gov', 'Satellite and topographic map tiles', 'When you pick Satellite or Topo', TILE_RECEIVES],
  ['RainViewer', 'api.rainviewer.com and the tile host it returns', 'Weather radar overlay', 'When you turn on Radar', TILE_RECEIVES],
  ['Iowa Environmental Mesonet (Iowa State University)', 'mesonet.agron.iastate.edu', 'Fallback weather radar tiles', 'When Radar is on and RainViewer is unreachable', TILE_RECEIVES],
  ['NOAA CoastWatch ERDDAP', 'coastwatch.pfeg.noaa.gov', 'Sea surface temperature overlay', 'When you turn on Sea temp', TILE_RECEIVES],
  ['Sentry', 'Sentry ingest host', 'Error reports (no default personal data)', 'Only when error monitoring is configured for this deployment', 'IP address, browser details, error details, page URL'],
];

export default async function CookiesPage() {
  const user = await getOptionalUser();
  return (
    <AppShell user={user ? { email: user.email ?? null } : null}>
      <article className="max-w-2xl text-sm text-slate-700">
        <LegalTitle>Cookie Policy</LegalTitle>
        <p className="mt-3">
          NimbusWatch only uses the cookies and browser storage it needs to work. There are no advertising, analytics or
          cross-site tracking cookies, so there is nothing to opt in to. This page lists exactly what is stored and what
          loads from other organisations.
        </p>

        <LegalHeading>Cookies</LegalHeading>
        <LegalTable
          head={['Name', 'Set by', 'Purpose', 'Type', 'How long']}
          rows={[
            [
              <code key="n">sb-&lt;project-ref&gt;-auth-token</code>,
              'Supabase Auth',
              'Keeps you signed in and refreshes your session. May be split into .0 and .1 parts.',
              'Necessary',
              'Until you sign out (the session refreshes automatically)',
            ],
          ]}
        />

        <LegalHeading>Browser storage</LegalHeading>
        <LegalTable
          head={['Key', 'Where', 'Purpose', 'Type']}
          rows={[
            [<code key="k">allclear.map.prefs</code>, 'localStorage', 'Remembers your chosen map style, overlays and history range on the live map', 'Functional'],
            [<code key="k">/sw.js</code>, 'Service worker (scope /)', 'Receives and shows push notifications, only after you turn them on', 'Necessary'],
            [<code key="k">cookie-consent</code>, 'localStorage', 'Remembers that you have seen the cookie notice', 'Necessary'],
          ]}
        />

        <LegalHeading>Other organisations your browser contacts</LegalHeading>
        <LegalTable head={['Organisation', 'Host', 'Why', 'When', 'What they receive']} rows={THIRD_PARTIES} />

        <LegalHeading>Your choices</LegalHeading>
        <p className="mt-1">
          You can clear or block cookies and site storage in your browser settings. Necessary items are needed for the
          site to work; blocking them will sign you out or stop push notifications.
        </p>
        <button
          type="button"
          data-cookie-settings
          className="mt-3 inline-flex min-h-11 items-center rounded-control border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Show the cookie notice again
        </button>

        <LegalHeading>Contact</LegalHeading>
        <p className="mt-1">
          Questions about this page: <ContactEmail />.
        </p>
      </article>
    </AppShell>
  );
}
