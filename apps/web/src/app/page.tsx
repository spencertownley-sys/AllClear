import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Bell, MapPinned, ShieldCheck, Layers } from 'lucide-react';
import { SOURCE_LABELS } from '@allclear/shared';
import { getOptionalUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/nav/app-shell';
import { Button } from '@/components/ui/button';
import { LiveMap } from '@/components/map/live-map';
import { SiteFooter } from '@/components/nav/site-footer';

/** Marketing / landing (logged out). Logged-in users go straight to their dashboard. */
export default async function LandingPage() {
  const user = await getOptionalUser();
  if (user) redirect('/dashboard');

  return (
    <AppShell user={null}>
      <section className="grid items-center gap-8 py-6 md:grid-cols-2 md:py-12">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Facts only. Every card names its source.
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            One calm screen for the places you care about.
          </h1>
          <p className="max-w-lg text-lg text-slate-600">
            Weather, wildfire, earthquakes, air quality and official alerts for home, family and your next trip — from
            official public feeds, with no doomscrolling and no guesswork.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Get started <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/map">Explore the live map</Link>
            </Button>
          </div>
          <p className="text-sm text-slate-500">Free. US coverage. No app install required.</p>
        </div>
        <div className="h-72 overflow-hidden rounded-card border border-slate-200 shadow-sm md:h-96">
          <LiveMap teaser />
        </div>
      </section>

      <section className="grid gap-4 py-8 md:grid-cols-3">
        {[
          {
            icon: MapPinned,
            title: 'Save the places you care about',
            body: 'Home, a parent’s city, an upcoming trip. Add as many as you like and label them however you think of them.',
          },
          {
            icon: Layers,
            title: 'Pick the layers that matter',
            body: 'Weather, wildfire & smoke, earthquakes and air quality — per place. Official alerts are always on as the safety net.',
          },
          {
            icon: Bell,
            title: 'Set your own thresholds',
            body: 'Fires within 25 miles. Quakes above M4.5. AQI over 100. You decide what earns a notification.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-card border border-slate-200 bg-white p-5">
            <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden />
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-card border border-slate-200 bg-white p-6 md:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Every fact is sourced</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          AllClear relays data from named public agencies and shows you where each fact came from. We never editorialize or
          predict — we just put it in one place.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(SOURCE_LABELS) as Array<keyof typeof SOURCE_LABELS>).map((k) => (
            <li key={k} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              {SOURCE_LABELS[k]}
            </li>
          ))}
        </ul>
      </section>

      <SiteFooter />
    </AppShell>
  );
}
