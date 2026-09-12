import 'server-only';
import {
  ApiError,
  DEFAULT_MIN_MAGNITUDE,
  DEFAULT_RADIUS_MILES,
  LAYER_TYPES,
  type LayerConfigDTO,
  type LayerType,
  type LayersPutInput,
  type LocationLayer,
} from '@allclear/shared';
import type { ServerSupabaseClient } from '@/lib/supabase/server';

export function toLayerDTO(row: LocationLayer): LayerConfigDTO {
  return {
    layer_type: row.layer_type,
    enabled: row.enabled,
    radius_miles: row.radius_miles === null ? null : Number(row.radius_miles),
    min_magnitude: row.min_magnitude === null ? null : Number(row.min_magnitude),
  };
}

function defaultLayer(layerType: LayerType): LayerConfigDTO {
  return {
    layer_type: layerType,
    enabled: true,
    radius_miles: DEFAULT_RADIUS_MILES[layerType],
    min_magnitude: layerType === 'earthquake' ? DEFAULT_MIN_MAGNITUDE : null,
  };
}

/** Always returns all four layers in a fixed order, filling gaps with defaults. */
export async function getLayers(supabase: ServerSupabaseClient, locationId: string): Promise<LayerConfigDTO[]> {
  const { data, error } = await supabase.from('location_layers').select('*').eq('watch_location_id', locationId);
  if (error) throw new ApiError('INTERNAL_ERROR', 'Could not load layer settings');
  const byType = new Map((data ?? []).map((row) => [row.layer_type, toLayerDTO(row)]));
  return LAYER_TYPES.map((t) => byType.get(t) ?? defaultLayer(t));
}

export async function putLayers(
  supabase: ServerSupabaseClient,
  locationId: string,
  input: LayersPutInput,
): Promise<LayerConfigDTO[]> {
  const rows = input.map((layer) => {
    const usesRadius = layer.layer_type === 'wildfire' || layer.layer_type === 'earthquake';
    return {
      watch_location_id: locationId,
      layer_type: layer.layer_type,
      enabled: layer.enabled,
      radius_miles: usesRadius ? (layer.radius_miles ?? DEFAULT_RADIUS_MILES[layer.layer_type]) : null,
      min_magnitude:
        layer.layer_type === 'earthquake' ? (layer.min_magnitude ?? DEFAULT_MIN_MAGNITUDE) : null,
    };
  });
  const { error } = await supabase
    .from('location_layers')
    .upsert(rows, { onConflict: 'watch_location_id,layer_type' });
  if (error) {
    console.error('[layers] upsert failed', error);
    throw new ApiError('INTERNAL_ERROR', 'Could not save layer settings');
  }
  return getLayers(supabase, locationId);
}

export function layerMap(layers: LayerConfigDTO[]): Record<LayerType, LayerConfigDTO> {
  const map = {} as Record<LayerType, LayerConfigDTO>;
  for (const t of LAYER_TYPES) map[t] = layers.find((l) => l.layer_type === t) ?? defaultLayer(t);
  return map;
}
