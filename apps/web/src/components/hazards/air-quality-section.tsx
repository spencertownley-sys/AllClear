import { Wind } from 'lucide-react';
import { aqiCategory, type AirQualityDTO } from '@allclear/shared';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { AqiBadge } from './aqi-badge';
import { HazardSection } from './section';

export function AirQualitySection({ airQuality }: { airQuality: AirQualityDTO | null }) {
  return (
    <HazardSection
      title="Air Quality"
      source="airnow"
      fetchedAt={airQuality?.fetched_at}
      stale={airQuality?.stale}
      icon={<Wind className="h-4 w-4" aria-hidden />}
      id="air-quality"
    >
      {!airQuality ? (
        <EmptyState
          title="No AirNow monitor reading yet"
          description="AirNow reports from the nearest monitoring station within about 30 miles. We refresh readings every 30 minutes."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold tabular-nums tracking-tight">{airQuality.aqi}</span>
            <AqiBadge aqi={airQuality.aqi} />
          </div>
          <p className="text-sm text-slate-700">{aqiCategory(airQuality.aqi).healthNote}</p>
          <p className="text-xs text-slate-500">
            {airQuality.pollutant ? `${airQuality.pollutant} · ` : ''}
            {airQuality.reporting_area ? `${airQuality.reporting_area} · ` : ''}
            {airQuality.observed_at ? `observed ${formatDateTime(airQuality.observed_at)}` : ''}
          </p>
        </div>
      )}
    </HazardSection>
  );
}
