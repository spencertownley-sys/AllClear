import type { BBox } from '@nimbuswatch/shared';

export interface MapLimits {
  /** Point markers from hazards_in_bbox, per group (fires; quakes and storms), most significant first. */
  markers: number;
  /** Polygons per polygon layer (perimeters, history, smoke) from hazard_polygons_in_bbox, largest first. */
  polygons: number;
}

/**
 * How much to send for a map view (NW-26). A national view used to return about 0.5 MB on load;
 * at that scale only the most significant markers and largest polygons are visible anyway, and the
 * RPCs already order by significance, so zooming in fills in the rest.
 */
export function mapLimitsFor(bbox: BBox): MapLimits {
  const area = Math.abs(bbox.maxLng - bbox.minLng) * Math.abs(bbox.maxLat - bbox.minLat);
  if (area > 600) return { markers: 1000, polygons: 150 }; // continental US and wider
  if (area > 100) return { markers: 1800, polygons: 300 }; // several states
  return { markers: 2500, polygons: 400 };
}

/** ~11 m precision is plenty for a map marker and trims every coordinate in the response. */
export function roundCoord(value: number | string): number {
  return Math.round(Number(value) * 1e4) / 1e4;
}
