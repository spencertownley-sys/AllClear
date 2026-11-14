import type { Metadata } from 'next';
import Link from 'next/link';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { SiteFooter } from '@/components/nav/site-footer';
import { ContactEmail, LegalHeading, LegalList, LegalTable, LegalTitle } from '@/components/legal/prose';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } };

/** Hosts the browser loads directly. Keep in step with components/map/* and the CSP in next.config.ts. */
const BROWSER_THIRD_PARTIES: Array<[string, string, string]> = [
  ['OpenStreetMap Foundation (tile.openstreetmap.org)', 'Street map tiles', 'When the map shows the Street style (the default)'],
  ['US Geological Survey, The National Map (basemap.nationalmap.gov)', 'Satellite and topographic map tiles', 'When you pick Satellite or Topo'],
  ['RainViewer (api.rainviewer.com and the tile host it returns)', 'Weather radar overlay', 'When you turn on Radar'],
  ['Iowa Environmental Mesonet, Iowa State University (mesonet.agron.iastate.edu)', 'Fallback weather radar tiles', 'When Radar is on and RainViewer is unreachable'],
  ['NOAA CoastWatch ERDDAP (coastwatch.pfeg.noaa.gov)', 'Sea surface temperature overlay', 'When you turn on Sea temp'],
  ['Sentry', 'Error reports (no default personal data, 10% of page transitions traced)', 'Only when error monitoring is configured for this deployment'],
];

const PROCESSORS: Array<[string, string, string]> = [
  ['Supabase', 'Database, authentication and API for all account data', 'United States (the region chosen for the project)'],
  ['Railway', 'Hosting of the web app and the background worker', 'United States'],
  ['Resend', 'Sends alert emails', 'United States'],
  ['Sentry', 'Error monitoring for the web app and worker, when configured', 'United States'],
  ['OpenStreetMap Foundation (Nominatim)', 'Turns place searches into coordinates; receives the search text from our server', 'United Kingdom'],
  ['Browser push services (Google, Mozilla, Apple or Microsoft, depending on your browser)', 'Deliver push notifications to your device', 'United States'],
];

export default async function PrivacyPage() {
  const user = await getOptionalUser();
  return (
    <AppShell user={user ? { email: user.email ?? null } : null}>
      <article className="max-w-2xl text-sm text-slate-700">
        <LegalTitle>Privacy Policy</LegalTitle>

        <LegalHeading>Who is responsible</LegalHeading>
        <p className="mt-1">
          NimbusWatch is run by {LEGAL.operatorName}, {LEGAL.operatorLocation}. Contact: <ContactEmail />.
        </p>

        <LegalHeading>What we collect</LegalHeading>
        <LegalList
          items={[
            'Your account email address and password hash (managed by Supabase Auth).',
            'The Watch Locations you save: precise latitude and longitude, your label, city, state and ZIP code.',
            'The hazard layers you choose and your notification rules (distance, magnitude and AQI thresholds).',
            'A log of the notifications we sent you.',
            'If you turn on push notifications: the push endpoint for your browser, its encryption keys and your browser user agent.',
            'Safety check-ins you record, including an optional note of up to 280 characters.',
            'Location search text, which our server sends to OpenStreetMap Nominatim to find coordinates.',
            'Technical data: like every website, our hosting provider receives your IP address and browser details in order to deliver pages and keep the service secure.',
          ]}
        />

        <LegalHeading>How we use it</LegalHeading>
        <p className="mt-1">
          We use your data to look up hazard information near the places you save, to send the notifications you set up,
          and to keep the service secure and working. Location data is never sold, never shared with advertisers and
          never used for advertising, including cross-context behavioural advertising.
        </p>
        <p className="mt-2">
          Legal bases under EU and UK law: providing the service you asked for (contract), keeping the service secure and
          working (legitimate interests), and your consent where something is optional, such as push notifications.
        </p>

        <LegalHeading>Where hazard data comes from</LegalHeading>
        <p className="mt-1">
          Hazard information comes from the National Weather Service, NASA FIRMS, the US Geological Survey, AirNow (EPA),
          NIFC and InciWeb, the National Hurricane Center, NOAA and other public agencies. Our servers fetch and cache this
          data; your browser does not contact those agencies and they do not learn which places you watch.
        </p>

        <LegalHeading>What your browser loads directly</LegalHeading>
        <p className="mt-1">
          Some content is loaded by your browser straight from other organisations. They receive your IP address, browser
          details and, for map tiles, the area of the map you are viewing.
        </p>
        <LegalTable head={['Organisation', 'Why', 'When']} rows={BROWSER_THIRD_PARTIES} />

        <LegalHeading>Service providers</LegalHeading>
        <p className="mt-1">These companies process data on our behalf to run NimbusWatch:</p>
        <LegalTable head={['Company', 'What they do', 'Where']} rows={PROCESSORS} />

        <LegalHeading>International transfers</LegalHeading>
        <p className="mt-1">
          Most of the companies above are based in the United States. Where data leaves the EU or UK it is covered by the
          provider&apos;s standard contractual clauses or Data Privacy Framework certification.
        </p>

        <LegalHeading>How long we keep it</LegalHeading>
        <LegalList
          items={[
            'Account data, Watch Locations, rules, check-ins and push subscriptions: until you delete them or delete your account.',
            'Notification log: [PLACEHOLDER: retention period for the notification log].',
            'Server and error logs: [PLACEHOLDER: retention period for hosting and error logs].',
          ]}
        />

        <LegalHeading>Your rights</LegalHeading>
        <LegalList
          items={[
            <>
              You can see and correct your places and rules in the app, and delete your account at any time from Settings,
              Account. Deleting your account removes everything listed above.
            </>,
            'EU and UK visitors: access, correction, deletion, restriction, objection, portability, withdrawing consent, and the right to complain to your data protection authority.',
            'California and other US state residents: the right to know, delete and correct. We do not sell or share personal information, and we honour Global Privacy Control signals.',
            <>
              To use any of these rights, email <ContactEmail />. You will get an answer within 30 days, and you will never
              be treated differently for using them.
            </>,
          ]}
        />

        <LegalHeading>Cookies and storage</LegalHeading>
        <p className="mt-1">
          We only use the cookies and browser storage the service needs to work. See the{' '}
          <Link href="/cookies" className="text-primary underline underline-offset-2">
            cookie policy
          </Link>{' '}
          for the full list.
        </p>

        <LegalHeading>Children</LegalHeading>
        <p className="mt-1">
          NimbusWatch is not directed at children under 13 (under 16 in the EU and UK) and does not knowingly collect their
          data.
        </p>

        <LegalHeading>Changes</LegalHeading>
        <p className="mt-1">
          If this policy changes in a way that matters, the date at the top changes and a notice is shown in the app.
        </p>
      </article>
      <SiteFooter />
    </AppShell>
  );
}
