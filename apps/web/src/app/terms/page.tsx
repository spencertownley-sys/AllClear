import type { Metadata } from 'next';
import Link from 'next/link';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { SiteFooter } from '@/components/nav/site-footer';
import { ContactEmail, LegalHeading, LegalList, LegalTitle } from '@/components/legal/prose';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service', alternates: { canonical: '/terms' } };

export default async function TermsPage() {
  const user = await getOptionalUser();
  return (
    <AppShell user={user ? { email: user.email ?? null } : null}>
      <article className="max-w-2xl text-sm text-slate-700">
        <LegalTitle>Terms of Service</LegalTitle>
        <p className="mt-2 rounded-card border border-slate-200 bg-white p-3 text-xs text-slate-600">
          [PLACEHOLDER: owner to review these terms before public launch. They are a plain-language draft, not legal
          advice.]
        </p>

        <LegalHeading>Not an emergency service</LegalHeading>
        <p className="mt-1">
          NimbusWatch is not an emergency alert system and is not for life-safety decisions. Data can be delayed,
          incomplete or wrong, and notifications can fail. In an emergency call 911 and follow instructions from local
          officials, Wireless Emergency Alerts and NOAA Weather Radio.
        </p>

        <LegalHeading>Who provides the service</LegalHeading>
        <p className="mt-1">
          NimbusWatch is provided by {LEGAL.operatorName}, {LEGAL.operatorLocation}. Contact: <ContactEmail />.
        </p>

        <LegalHeading>What the service is</LegalHeading>
        <p className="mt-1">
          NimbusWatch shows publicly available hazard data for the places you choose and can notify you when your own
          thresholds are met. It is provided as is and as available, without warranties of any kind, to the extent the
          law allows.
        </p>

        <LegalHeading>Accounts</LegalHeading>
        <LegalList
          items={[
            'One person per account. Use an email address you control and keep it accurate, because alerts go to it.',
            'Keep your password safe. You are responsible for what happens under your account.',
            'You must be at least 13 years old (16 in the EU and UK) to create an account.',
          ]}
        />

        <LegalHeading>Acceptable use</LegalHeading>
        <p className="mt-1">
          Use NimbusWatch for personal situational awareness. Don&apos;t scrape the service, overload the public map API,
          attempt to access another person&apos;s data, use it for anything unlawful, or try to break or get around its
          security.
        </p>

        <LegalHeading>Fair-use limits</LegalHeading>
        <p className="mt-1">
          To keep the service working for everyone, each account can save up to 25 Watch Locations, 50 notification rules
          and 10 push-enabled browsers or devices.
        </p>

        <LegalHeading>Your content</LegalHeading>
        <p className="mt-1">
          You keep ownership of what you enter, such as place labels and check-in notes. You give us only the permission
          needed to store it and run the service for you.
        </p>

        <LegalHeading>Price</LegalHeading>
        <p className="mt-1">NimbusWatch is free. There are no paid plans, so there is nothing to cancel or refund.</p>

        <LegalHeading>Data sources and attribution</LegalHeading>
        <p className="mt-1">
          Hazard data is provided by the National Weather Service, NASA FIRMS, USGS, AirNow (EPA), NIFC and InciWeb, the
          National Hurricane Center and other public agencies under their respective terms. Map tiles and overlays:
          street map &copy; OpenStreetMap contributors; satellite and topographic tiles from USGS The National Map; radar
          from RainViewer and the Iowa Environmental Mesonet (Iowa State University); sea surface temperature from NOAA
          CoastWatch ERDDAP and NASA JPL MUR.
        </p>

        <LegalHeading>Ending your account</LegalHeading>
        <p className="mt-1">
          You can delete your account at any time from Settings, Account, which removes your data as described in the{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            privacy policy
          </Link>
          . We may suspend or close an account that breaks these terms or puts the service or other people at risk.
        </p>

        <LegalHeading>Limitation of liability</LegalHeading>
        <p className="mt-1">
          To the extent the law allows, we are not liable for any loss or harm arising from use of the service, including
          from missed, late or wrong alerts, or from data that is delayed, incomplete or inaccurate.
        </p>

        <LegalHeading>Governing law</LegalHeading>
        <p className="mt-1">These terms are governed by the laws of {LEGAL.governingLaw}.</p>

        <LegalHeading>Changes</LegalHeading>
        <p className="mt-1">
          If these terms change in a way that matters, the date at the top changes and a notice is shown in the app.
          Continuing to use NimbusWatch after a change means you accept the new terms.
        </p>
      </article>
      <SiteFooter />
    </AppShell>
  );
}
