'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { HazardMapProps } from './hazard-map-inner';

/** Leaflet touches `window` at import time, so the real map is loaded client-side only. */
const HazardMapInner = dynamic(() => import('./hazard-map-inner'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-card" />,
});

export function HazardMap(props: HazardMapProps) {
  return <HazardMapInner {...props} />;
}

export type { HazardMapProps, MapPin, MapPolygon } from './hazard-map-inner';
