import { CELL_SIZE_DEG, cellCenter, cellKey, type LatLng, type LayerType } from '@allclear/shared';
import type { WatchLocationWithLayers } from './db';

export interface Cell extends LatLng {
  key: string;
}

function layerEnabled(location: WatchLocationWithLayers, layer: LayerType): boolean {
  const row = location.location_layers.find((l) => l.layer_type === layer);
  return row ? row.enabled : true;
}

/**
 * Unique grid cells to poll for a per-point source. Polling scales with geographic coverage,
 * not user count (Tech Spec §6): ten users in the same town share one cell.
 */
export function cellsFor(
  locations: WatchLocationWithLayers[],
  kind: keyof typeof CELL_SIZE_DEG,
  requiredLayer: LayerType | null,
): Cell[] {
  const step = CELL_SIZE_DEG[kind];
  const cells = new Map<string, Cell>();
  for (const loc of locations) {
    if (requiredLayer && !layerEnabled(loc, requiredLayer)) continue;
    const key = cellKey(loc, step);
    if (!cells.has(key)) cells.set(key, { key, ...cellCenter(loc, step) });
  }
  return Array.from(cells.values());
}
