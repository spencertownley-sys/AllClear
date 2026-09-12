const EARTH_RADIUS_MILES = 3958.7613;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in statute miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Snap a coordinate to the centre of a grid cell of `stepDeg` degrees. */
export function cellCenter(point: LatLng, stepDeg: number): LatLng {
  const snap = (v: number) => Math.round(v / stepDeg) * stepDeg;
  const decimals = Math.max(0, Math.ceil(-Math.log10(stepDeg)) + 1);
  return {
    latitude: Number(snap(point.latitude).toFixed(decimals)),
    longitude: Number(snap(point.longitude).toFixed(decimals)),
  };
}

export function cellKey(point: LatLng, stepDeg: number): string {
  const c = cellCenter(point, stepDeg);
  return `${c.latitude},${c.longitude}`;
}

/** Bounding box that fully contains a circle of `radiusMiles` around `center`. */
export function bboxAround(center: LatLng, radiusMiles: number): BBox {
  const dLat = radiusMiles / 69.0;
  const cos = Math.max(0.01, Math.cos(toRadians(center.latitude)));
  const dLng = radiusMiles / (69.172 * cos);
  return {
    minLat: Math.max(-90, center.latitude - dLat),
    maxLat: Math.min(90, center.latitude + dLat),
    minLng: Math.max(-180, center.longitude - dLng),
    maxLng: Math.min(180, center.longitude + dLng),
  };
}

/** Parse "minLng,minLat,maxLng,maxLat". Returns null when malformed. */
export function parseBbox(input: string): BBox | null {
  const parts = input.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat > maxLat || minLng > maxLng) return null;
  return { minLng, minLat, maxLng, maxLat };
}

/** Merge overlapping/adjacent bounding boxes to reduce the number of external requests. */
export function mergeBboxes(boxes: BBox[], paddingDeg = 0): BBox[] {
  const result: BBox[] = [];
  const remaining = boxes.map((b) => ({ ...b }));
  while (remaining.length > 0) {
    let current = remaining.pop() as BBox;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const other = remaining[i] as BBox;
        const overlaps =
          current.minLng - paddingDeg <= other.maxLng &&
          current.maxLng + paddingDeg >= other.minLng &&
          current.minLat - paddingDeg <= other.maxLat &&
          current.maxLat + paddingDeg >= other.minLat;
        if (overlaps) {
          current = {
            minLng: Math.min(current.minLng, other.minLng),
            minLat: Math.min(current.minLat, other.minLat),
            maxLng: Math.max(current.maxLng, other.maxLng),
            maxLat: Math.max(current.maxLat, other.maxLat),
          };
          remaining.splice(i, 1);
          merged = true;
        }
      }
    }
    result.push(current);
  }
  return result;
}

export function formatMiles(miles: number): string {
  if (miles < 1) return '<1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Parse a degrees/minutes/seconds string such as "47° 24 50" into decimal degrees. */
export function parseDms(input: string): number | null {
  const nums = input
    .replace(/[^0-9.\-\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
  if (nums.length === 0 || nums.some((n) => !Number.isFinite(n))) return null;
  const [deg = 0, min = 0, sec = 0] = nums;
  const sign = deg < 0 ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}
