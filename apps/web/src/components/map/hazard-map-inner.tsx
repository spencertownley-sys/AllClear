'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  WMSTileLayer,
  useMap,
  useMapEvents,
  type GeoJSONProps,
} from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { GeoJsonGeometry, HistoricalFireDTO, MapFireDTO, MapQuakeDTO, StormDTO } from '@allclear/shared';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  BASEMAPS,
  DEFAULT_OVERLAYS,
  OVERLAYS,
  RADAR_TILE_URL,
  SST_WMS_LAYER,
  SST_WMS_URL,
  type BasemapId,
  type OverlayState,
} from './basemaps';

export interface MapPin {
  latitude: number;
  longitude: number;
  label: string;
  radiusMiles?: number | null;
}

/** A fire perimeter polygon; the public map and the location detail both feed this shape. */
export interface MapPolygon {
  id: string;
  name: string;
  acres: number | null;
  containment_pct: number | null;
  updated_at?: string | null;
  distance_miles?: number;
  geojson: GeoJsonGeometry;
}

export interface HazardMapProps {
  center: [number, number];
  zoom: number;
  fires?: MapFireDTO[];
  quakes?: MapQuakeDTO[];
  perimeters?: MapPolygon[];
  history?: HistoricalFireDTO[];
  storms?: StormDTO[];
  pins?: MapPin[];
  basemap?: BasemapId;
  overlays?: Partial<OverlayState>;
  interactive?: boolean;
  fitBounds?: LatLngBoundsExpression;
  onMoveEnd?: (bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }, zoom: number) => void;
  onClick?: (latlng: { latitude: number; longitude: number }) => void;
  className?: string;
  ariaLabel?: string;
}

function Events({ onMoveEnd, onClick }: Pick<HazardMapProps, 'onMoveEnd' | 'onClick'>) {
  const map = useMapEvents({
    moveend() {
      if (!onMoveEnd) return;
      const b = map.getBounds();
      onMoveEnd(
        { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
        map.getZoom(),
      );
    },
    click(e) {
      onClick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  useEffect(() => {
    if (!onMoveEnd) return;
    const b = map.getBounds();
    onMoveEnd({ minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() }, map.getZoom());
    // Fire once on mount so the first viewport loads data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function quakeRadius(magnitude: number): number {
  return Math.max(4, Math.min(22, magnitude * 3));
}

function stormRadius(kt: number | null): number {
  return kt === null ? 9 : Math.max(8, Math.min(20, kt / 7));
}

function compass(deg: number | null): string {
  if (deg === null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? '';
}

type GeoJsonData = GeoJSONProps['data'];
function feature(geometry: GeoJsonGeometry): GeoJsonData {
  return { type: 'Feature', properties: {}, geometry } as unknown as GeoJsonData;
}

const ACTIVE_PERIMETER_STYLE = { color: '#b91c1c', weight: 2, fillColor: '#ef4444', fillOpacity: 0.22 };
const HISTORY_PERIMETER_STYLE = { color: '#78716c', weight: 1.5, dashArray: '4 3', fillColor: '#a8a29e', fillOpacity: 0.16 };

/**
 * Leaflet map with a switchable free basemap, optional radar / sea-temperature overlays,
 * vector hazard markers and fire-perimeter polygons (no image icons, no API key).
 */
export default function HazardMapInner({
  center,
  zoom,
  fires = [],
  quakes = [],
  perimeters = [],
  history = [],
  storms = [],
  pins = [],
  basemap = 'street',
  overlays,
  interactive = true,
  onMoveEnd,
  onClick,
  className,
  ariaLabel = 'Map',
}: HazardMapProps) {
  const base = BASEMAPS[basemap] ?? BASEMAPS.street;
  const ov: OverlayState = { ...DEFAULT_OVERLAYS, ...overlays };
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className ?? 'h-full w-full'}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      zoomControl={interactive}
      attributionControl
      aria-label={ariaLabel}
    >
      <TileLayer key={basemap} attribution={base.attribution} url={base.url} maxZoom={base.maxZoom} zIndex={1} />
      {ov.sst ? (
        <WMSTileLayer
          key="sst"
          url={SST_WMS_URL}
          layers={SST_WMS_LAYER}
          format="image/png"
          transparent
          version="1.3.0"
          opacity={0.55}
          zIndex={2}
          attribution={OVERLAYS.sst.attribution}
        />
      ) : null}
      {ov.radar ? (
        <TileLayer key="radar" url={RADAR_TILE_URL} opacity={0.65} zIndex={3} attribution={OVERLAYS.radar.attribution} />
      ) : null}
      <Recenter center={center} zoom={zoom} />
      {interactive ? <Events onMoveEnd={onMoveEnd} onClick={onClick} /> : null}

      {history.map((h) => (
        <GeoJSON key={`hist-${h.id}`} data={feature(h.geojson)} style={HISTORY_PERIMETER_STYLE}>
          <Popup>
            <strong>{h.name}</strong>
            {h.year ? ` (${h.year})` : ''}
            <br />
            {h.acres ? `${formatNumber(Math.round(h.acres))} acres` : 'Size unknown'}
            <br />
            <span style={{ fontSize: 11 }}>Past fire · Source: NIFC fire history</span>
          </Popup>
        </GeoJSON>
      ))}

      {perimeters.map((p) => (
        <GeoJSON key={`perim-${p.id}`} data={feature(p.geojson)} style={ACTIVE_PERIMETER_STYLE}>
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.containment_pct !== null ? `${Math.round(p.containment_pct)}% contained` : 'Containment unknown'}
            {p.acres ? ` · ${formatNumber(Math.round(p.acres))} acres` : ''}
            <br />
            {p.updated_at ? (
              <>
                Perimeter updated {formatDateTime(p.updated_at)}
                <br />
              </>
            ) : null}
            <span style={{ fontSize: 11 }}>Active fire perimeter · Source: NIFC (WFIGS)</span>
          </Popup>
        </GeoJSON>
      ))}

      {pins.map((pin, i) => (
        <CircleMarker
          key={`pin-${i}`}
          center={[pin.latitude, pin.longitude]}
          radius={8}
          pathOptions={{ color: '#0f6b66', fillColor: '#0f6b66', fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>{pin.label}</Popup>
        </CircleMarker>
      ))}

      {fires.map((f, i) => (
        <CircleMarker
          key={`fire-${i}`}
          center={[f.latitude, f.longitude]}
          radius={f.kind === 'incident' ? 7 : 4}
          pathOptions={{
            color: f.kind === 'incident' ? '#b91c1c' : '#ea580c',
            fillColor: f.kind === 'incident' ? '#dc2626' : '#f97316',
            fillOpacity: 0.75,
            weight: 1,
          }}
        >
          <Popup>
            <strong>{f.kind === 'incident' ? (f.name ?? 'Wildfire incident') : 'Satellite hotspot'}</strong>
            <br />
            {f.kind === 'incident' ? (
              <>
                {f.containment_pct !== null && f.containment_pct !== undefined ? `${Math.round(f.containment_pct)}% contained` : 'Containment unknown'}
                {f.acres ? ` · ${formatNumber(f.acres)} acres` : ''}
                <br />
              </>
            ) : null}
            Detected {formatDateTime(f.detected_at)}
            <br />
            <span style={{ fontSize: 11 }}>Source: {f.source === 'firms' ? 'NASA FIRMS' : 'NIFC / InciWeb'}</span>
          </Popup>
        </CircleMarker>
      ))}

      {quakes.map((q, i) => (
        <CircleMarker
          key={`quake-${i}`}
          center={[q.latitude, q.longitude]}
          radius={quakeRadius(q.magnitude)}
          pathOptions={{ color: '#6d28d9', fillColor: '#8b5cf6', fillOpacity: 0.45, weight: 1 }}
        >
          <Popup>
            <strong>M{q.magnitude.toFixed(1)}</strong> — {q.place}
            <br />
            {formatDateTime(q.occurred_at)}
            <br />
            <span style={{ fontSize: 11 }}>Source: USGS</span>
          </Popup>
        </CircleMarker>
      ))}

      {storms.map((s) => (
        <CircleMarker
          key={`storm-${s.id}`}
          center={[s.latitude, s.longitude]}
          radius={stormRadius(s.intensity_kt)}
          pathOptions={{ color: '#075985', fillColor: '#0ea5e9', fillOpacity: 0.5, weight: 2 }}
        >
          <Popup>
            <strong>
              {s.classification} {s.name}
            </strong>
            <br />
            {s.intensity_kt !== null ? `Max winds ${Math.round(s.intensity_kt * 1.15078)} mph` : 'Winds unknown'}
            {s.pressure_mb !== null ? ` · ${s.pressure_mb} mb` : ''}
            <br />
            {s.movement_mph !== null ? `Moving ${compass(s.movement_dir)} at ${Math.round(s.movement_mph)} mph` : 'Movement unknown'}
            <br />
            {s.last_update ? `As of ${formatDateTime(s.last_update)}` : ''}
            {s.url ? (
              <>
                <br />
                <a href={s.url} target="_blank" rel="noreferrer">
                  NHC advisory
                </a>
              </>
            ) : null}
            <br />
            <span style={{ fontSize: 11 }}>Source: NOAA National Hurricane Center</span>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
