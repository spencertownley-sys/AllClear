/**
 * RainViewer's free, key-less radar mosaic (https://www.rainviewer.com/api.html).
 *
 * This replaces the old single-source IEM NEXRAD composite: RainViewer blends radar from the
 * US, Canada, Europe and dozens of other national networks into one worldwide mosaic, so it
 * covers Alaska, Hawaii, Puerto Rico and non-CONUS Watch Locations that the old composite
 * showed nothing for. It also publishes the last ~2 hours of frames, which is what lets the
 * map animate recent movement instead of showing one static image.
 *
 * `LEGACY_RADAR_TILE_URL` (Iowa Environmental Mesonet's CONUS NEXRAD composite) is kept as a
 * fallback: if a viewer's browser can't reach RainViewer's metadata endpoint, the overlay falls
 * back to it rather than showing nothing (Rule 5: never a blank gap).
 */
export const RAINVIEWER_INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';

/** Color scheme 6 ("NEXRAD Level-III") reads as the familiar green/yellow/red Doppler banding. */
export const RADAR_COLOR_SCHEME = 6;
/** smoothing on, snow shown in its own color. */
export const RADAR_TILE_OPTIONS = '1_1';
export const RADAR_TILE_SIZE = 256;

export const LEGACY_RADAR_TILE_URL = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';

export interface RadarFrame {
  /** Unix seconds this frame was observed. */
  time: number;
  /** Path fragment RainViewer expects between the host and the tile template. */
  path: string;
}

export interface RadarIndex {
  host: string;
  /** Observed frames, oldest first, spanning roughly the last two hours. */
  frames: RadarFrame[];
}

interface RainViewerResponse {
  host?: string;
  radar?: { past?: RadarFrame[] };
}

/** Fetch the current set of available radar frames. Throws on any network or shape problem. */
export async function fetchRadarIndex(signal?: AbortSignal): Promise<RadarIndex> {
  const res = await fetch(RAINVIEWER_INDEX_URL, { signal });
  if (!res.ok) throw new Error(`RainViewer index responded ${res.status}`);
  const body = (await res.json()) as RainViewerResponse;
  const frames = body.radar?.past;
  if (!body.host || !Array.isArray(frames) || frames.length === 0) {
    throw new Error('RainViewer index missing frames');
  }
  return { host: body.host, frames };
}

/** Build the tile URL template (with Leaflet's {z}/{x}/{y} placeholders intact) for one frame. */
export function radarFrameTileUrl(host: string, frame: RadarFrame, size: number = RADAR_TILE_SIZE): string {
  return `${host}${frame.path}/${size}/{z}/{x}/{y}/${RADAR_COLOR_SCHEME}/${RADAR_TILE_OPTIONS}.png`;
}
