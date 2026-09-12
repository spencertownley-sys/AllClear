import { airnowPoller } from './airnow';
import { epaUvPoller } from './epa-uv';
import { firmsPoller } from './firms';
import { nhcPoller } from './nhc';
import { nifcPoller } from './nifc';
import { nifcHistoryPoller } from './nifc-history';
import { nifcPerimetersPoller } from './nifc-perimeters';
import { nwsAlertsPoller } from './nws-alerts';
import { nwsWeatherPoller } from './nws-weather';
import { usgsPoller } from './usgs';
import type { Poller } from './types';

export const pollers: Poller[] = [
  usgsPoller,
  nwsAlertsPoller,
  nwsWeatherPoller,
  firmsPoller,
  nifcPoller,
  nifcPerimetersPoller,
  nhcPoller,
  airnowPoller,
  epaUvPoller,
  nifcHistoryPoller,
];

export type { Poller, PollerContext, PollerResult } from './types';
