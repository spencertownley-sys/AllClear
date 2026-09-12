'use client';

import {
  DEFAULT_MIN_MAGNITUDE,
  DEFAULT_RADIUS_MILES,
  LAYER_DESCRIPTIONS,
  LAYER_LABELS,
  LAYER_TYPES,
  MAGNITUDE_LIMITS,
  RADIUS_LIMITS,
  type LayerConfigDTO,
  type LayerType,
} from '@allclear/shared';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Lock } from 'lucide-react';

interface LayerEditorProps {
  layers: LayerConfigDTO[];
  onChange: (layers: LayerConfigDTO[]) => void;
  disabled?: boolean;
}

export function defaultLayers(): LayerConfigDTO[] {
  return LAYER_TYPES.map((layer_type) => ({
    layer_type,
    enabled: true,
    radius_miles: DEFAULT_RADIUS_MILES[layer_type],
    min_magnitude: layer_type === 'earthquake' ? DEFAULT_MIN_MAGNITUDE : null,
  }));
}

/** Per-location layer toggles with radius/magnitude controls. Official Alerts is shown but locked on. */
export function LayerEditor({ layers, onChange, disabled }: LayerEditorProps) {
  function update(layerType: LayerType, patch: Partial<LayerConfigDTO>) {
    onChange(layers.map((l) => (l.layer_type === layerType ? { ...l, ...patch } : l)));
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-card border border-slate-200 bg-white">
      {layers.map((layer) => {
        const usesRadius = layer.layer_type === 'wildfire' || layer.layer_type === 'earthquake';
        const radius = layer.radius_miles ?? DEFAULT_RADIUS_MILES[layer.layer_type] ?? 25;
        const switchId = `layer-${layer.layer_type}`;
        return (
          <li key={layer.layer_type} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor={switchId} className="font-medium text-slate-900">
                  {LAYER_LABELS[layer.layer_type]}
                </label>
                <p className="mt-0.5 text-sm text-slate-500">{LAYER_DESCRIPTIONS[layer.layer_type]}</p>
              </div>
              <Switch
                id={switchId}
                checked={layer.enabled}
                disabled={disabled}
                onCheckedChange={(enabled) => update(layer.layer_type, { enabled })}
                aria-label={`${LAYER_LABELS[layer.layer_type]} layer`}
              />
            </div>
            {layer.enabled && usesRadius ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor={`${switchId}-radius`} className="text-slate-700">
                    Watch radius
                  </label>
                  <span className="font-medium tabular-nums text-slate-900">{Math.round(radius)} miles</span>
                </div>
                <Slider
                  id={`${switchId}-radius`}
                  min={RADIUS_LIMITS.min}
                  max={layer.layer_type === 'wildfire' ? 100 : 300}
                  step={1}
                  value={[radius]}
                  disabled={disabled}
                  onValueChange={([v]) => update(layer.layer_type, { radius_miles: v ?? radius })}
                  aria-label={`${LAYER_LABELS[layer.layer_type]} radius in miles`}
                />
              </div>
            ) : null}
            {layer.enabled && layer.layer_type === 'earthquake' ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor={`${switchId}-mag`} className="text-slate-700">
                    Minimum magnitude to show
                  </label>
                  <span className="font-medium tabular-nums text-slate-900">
                    M{(layer.min_magnitude ?? DEFAULT_MIN_MAGNITUDE).toFixed(1)}+
                  </span>
                </div>
                <Slider
                  id={`${switchId}-mag`}
                  min={MAGNITUDE_LIMITS.min}
                  max={8}
                  step={0.1}
                  value={[layer.min_magnitude ?? DEFAULT_MIN_MAGNITUDE]}
                  disabled={disabled}
                  onValueChange={([v]) => update(layer.layer_type, { min_magnitude: v ?? DEFAULT_MIN_MAGNITUDE })}
                  aria-label="Minimum earthquake magnitude"
                />
              </div>
            ) : null}
          </li>
        );
      })}
      <li className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="font-medium text-slate-900">{LAYER_LABELS.official_alerts}</p>
          <p className="mt-0.5 text-sm text-slate-500">{LAYER_DESCRIPTIONS.official_alerts}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Always on
        </span>
      </li>
    </ul>
  );
}
