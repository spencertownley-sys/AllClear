/** Minimal GeoJSON → EWKT conversion for NWS alert polygons (PostGIS geography input). */
type Position = number[];
interface Geometry {
  type: string;
  coordinates?: unknown;
  geometries?: Geometry[];
}

function ring(coords: Position[]): string {
  return `(${coords.map((c) => `${c[0]} ${c[1]}`).join(',')})`;
}

function polygon(coords: Position[][]): string {
  return `(${coords.map(ring).join(',')})`;
}

export function geojsonToEwkt(geometry: Geometry | null | undefined): string | null {
  if (!geometry) return null;
  switch (geometry.type) {
    case 'Point': {
      const c = geometry.coordinates as Position;
      return `SRID=4326;POINT(${c[0]} ${c[1]})`;
    }
    case 'Polygon':
      return `SRID=4326;POLYGON${polygon(geometry.coordinates as Position[][])}`;
    case 'MultiPolygon':
      return `SRID=4326;MULTIPOLYGON(${(geometry.coordinates as Position[][][]).map(polygon).join(',')})`;
    case 'GeometryCollection': {
      const parts = (geometry.geometries ?? []).map((g) => geojsonToEwkt(g)?.replace('SRID=4326;', '')).filter(Boolean);
      return parts.length ? `SRID=4326;GEOMETRYCOLLECTION(${parts.join(',')})` : null;
    }
    default:
      return null;
  }
}

function walk(coords: unknown, fn: (lng: number, lat: number) => void) {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    fn(coords[0], coords[1]);
    return;
  }
  for (const c of coords) walk(c, fn);
}

/** Centre of the geometry's bounding box — good enough to place a perimeter's marker and proximity point. */
export function bboxCenter(geometry: Geometry | null | undefined): { latitude: number; longitude: number } | null {
  if (!geometry) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity, n = 0;
  walk(geometry.coordinates, (lng, lat) => {
    n += 1;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  if (n === 0) return null;
  return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 };
}

export function vertexCount(geometry: Geometry | null | undefined): number {
  let n = 0;
  if (geometry) walk(geometry.coordinates, () => (n += 1));
  return n;
}
