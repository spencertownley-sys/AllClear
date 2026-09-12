import { aqiCategory, type AqiTone } from '@allclear/shared';
import { Badge } from '@/components/ui/badge';

const TONE_MAP: Record<AqiTone, 'good' | 'warning' | 'danger' | 'purple' | 'maroon' | 'neutral'> = {
  good: 'good',
  moderate: 'warning',
  sensitive: 'warning',
  unhealthy: 'danger',
  very_unhealthy: 'purple',
  hazardous: 'maroon',
};

export function AqiBadge({ aqi }: { aqi: number }) {
  const category = aqiCategory(aqi);
  return (
    <Badge tone={TONE_MAP[category.tone]}>
      AQI {aqi} · {category.name}
    </Badge>
  );
}
