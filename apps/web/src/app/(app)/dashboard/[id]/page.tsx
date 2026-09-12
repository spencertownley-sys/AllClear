import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { ApiError, type WatchLocation, type LayerConfigDTO } from '@allclear/shared';
import { createClient, type ServerSupabaseClient } from '@/lib/supabase/server';
import { getOwnedLocation, toLocationDTO } from '@/lib/data/locations';
import { getLayers } from '@/lib/data/layers';
import { layerContext, loadAirQuality, loadAlerts, loadEarthquakes, loadStorms, loadWeather, loadWildfire } from '@/lib/data/hazards';
import { placeLine } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionErrorBoundary } from '@/components/ui/section-error-boundary';
import { LocationActions } from '@/components/location/location-actions';
import { WeatherSection } from '@/components/hazards/weather-section';
import { WildfireSection } from '@/components/hazards/wildfire-section';
import { EarthquakeSection } from '@/components/hazards/earthquake-section';
import { AirQualitySection } from '@/components/hazards/air-quality-section';
import { AlertsSection } from '@/components/hazards/alerts-section';
import { ActiveAlertBanner } from '@/components/hazards/active-alert-banner';
import { StormsNotice } from '@/components/hazards/storms-notice';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const location = await getOwnedLocation(supabase, id);
    return { title: location.label };
  } catch {
    return { title: 'Location' };
  }
}

function SectionSkeleton() {
  return <Skeleton className="h-40 w-full rounded-card" />;
}

type Ctx = ReturnType<typeof layerContext>;

async function Weather({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  return <WeatherSection weather={await loadWeather(supabase, ctx)} />;
}
async function Storms({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  return <StormsNotice storms={await loadStorms(supabase, ctx)} />;
}
async function Wildfire({ supabase, ctx, location }: { supabase: ServerSupabaseClient; ctx: Ctx; location: WatchLocation }) {
  const wildfire = await loadWildfire(supabase, ctx);
  return <WildfireSection wildfire={wildfire} center={{ latitude: ctx.lat, longitude: ctx.lng, label: location.label }} />;
}
async function Earthquakes({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  return <EarthquakeSection earthquakes={await loadEarthquakes(supabase, ctx)} />;
}
async function AirQuality({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  return <AirQualitySection airQuality={await loadAirQuality(supabase, ctx)} />;
}
async function Alerts({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  return <AlertsSection alerts={await loadAlerts(supabase, ctx)} />;
}
async function AlertBanner({ supabase, ctx }: { supabase: ServerSupabaseClient; ctx: Ctx }) {
  const alerts = await loadAlerts(supabase, ctx);
  return <ActiveAlertBanner alerts={alerts} />;
}

/** Full breakdown of every enabled layer; sections stream and fail independently. */
export default async function LocationDetailPage({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  let location: WatchLocation;
  let layers: LayerConfigDTO[];
  try {
    location = await getOwnedLocation(supabase, id);
    layers = await getLayers(supabase, location.id);
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN' || error.code === 'VALIDATION_ERROR')) notFound();
    throw error;
  }
  const ctx = layerContext(location, layers);
  const place = placeLine(location);

  return (
    <>
      <PageHeader
        back={
          <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Watch List
          </Link>
        }
        title={location.label}
        description={[place, location.is_primary ? 'Primary' : null].filter(Boolean).join(' · ') || undefined}
        actions={<LocationActions location={toLocationDTO(location)} layers={layers} />}
      />
      {location.is_primary ? <span className="sr-only"><Star className="h-4 w-4" aria-hidden />Primary location</span> : null}

      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <AlertBanner supabase={supabase} ctx={ctx} />
        </Suspense>
        {ctx.cfg.weather.enabled ? (
          <>
            <SectionErrorBoundary label="tropical storm data">
              <Suspense fallback={null}>
                <Storms supabase={supabase} ctx={ctx} />
              </Suspense>
            </SectionErrorBoundary>
            <SectionErrorBoundary label="weather">
              <Suspense fallback={<SectionSkeleton />}>
                <Weather supabase={supabase} ctx={ctx} />
              </Suspense>
            </SectionErrorBoundary>
          </>
        ) : null}
        {ctx.cfg.wildfire.enabled ? (
          <SectionErrorBoundary label="wildfire data">
            <Suspense fallback={<SectionSkeleton />}>
              <Wildfire supabase={supabase} ctx={ctx} location={location} />
            </Suspense>
          </SectionErrorBoundary>
        ) : null}
        {ctx.cfg.earthquake.enabled ? (
          <SectionErrorBoundary label="earthquake data">
            <Suspense fallback={<SectionSkeleton />}>
              <Earthquakes supabase={supabase} ctx={ctx} />
            </Suspense>
          </SectionErrorBoundary>
        ) : null}
        {ctx.cfg.air_quality.enabled ? (
          <SectionErrorBoundary label="air quality">
            <Suspense fallback={<SectionSkeleton />}>
              <AirQuality supabase={supabase} ctx={ctx} />
            </Suspense>
          </SectionErrorBoundary>
        ) : null}
        <SectionErrorBoundary label="official alerts">
          <Suspense fallback={<SectionSkeleton />}>
            <Alerts supabase={supabase} ctx={ctx} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </>
  );
}
