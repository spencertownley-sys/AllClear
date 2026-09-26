/**
 * Free, key-less tile sources. Everything here is public and usable without an account:
 * OpenStreetMap (street), USGS The National Map (satellite imagery + topo),
 * RainViewer's worldwide radar mosaic (radar; see ./radar.ts) and NOAA CoastWatch ERDDAP (sea temperature).
 */
export const BASEMAP_IDS = ['street', 'satellite', 'topo'] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

export interface BasemapDef {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
  street: {
    label: 'Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>',
    maxZoom: 16,
  },
  topo: {
    label: 'Topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Topo &copy; <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>',
    maxZoom: 16,
  },
};

export const OVERLAY_IDS = ['radar', 'sst'] as const;
export type OverlayId = (typeof OVERLAY_IDS)[number];

export interface OverlayDef {
  label: string;
  description: string;
  attribution: string;
}

export const OVERLAYS: Record<OverlayId, OverlayDef> = {
  radar: {
    label: 'Radar',
    description: 'Doppler radar mosaic with the last ~2 hours animated (refreshes about every 10 minutes).',
    attribution:
      'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a> (NWS NEXRAD and partner networks); falls back to <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a> if unreachable',
  },
  sst: {
    label: 'Sea temp',
    description: 'Daily sea-surface temperature (NASA JPL MUR, via NOAA CoastWatch).',
    attribution: 'SST &copy; <a href="https://coastwatch.pfeg.noaa.gov/erddap/">NOAA CoastWatch ERDDAP</a> / NASA JPL MUR',
  },
};

export const SST_WMS_URL = 'https://coastwatch.pfeg.noaa.gov/erddap/wms/jplMURSST41/request?';
export const SST_WMS_LAYER = 'jplMURSST41:analysed_sst';

export type OverlayState = Record<OverlayId, boolean>;
export const DEFAULT_OVERLAYS: OverlayState = { radar: false, sst: false };
