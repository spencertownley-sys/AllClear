/**
 * Coarse categories for NWS alert event names so the UI can offer
 * "Flood / Fire / Wind / …" filter chips (a Watch Duty-style request).
 * Derived purely from the event string; unknown events fall into "other".
 */
export const ALERT_CATEGORIES = [
  'flood',
  'fire',
  'wind',
  'storm',
  'winter',
  'heat',
  'tropical',
  'marine',
  'air',
  'other',
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  flood: 'Flood',
  fire: 'Fire',
  wind: 'Wind',
  storm: 'Severe storm',
  winter: 'Winter',
  heat: 'Heat',
  tropical: 'Tropical',
  marine: 'Marine',
  air: 'Air quality',
  other: 'Other',
};

const RULES: Array<[AlertCategory, RegExp]> = [
  ['tropical', /hurricane|tropical|typhoon|storm surge/i],
  ['fire', /fire|red flag|smoke/i],
  ['flood', /flood|flash|dam |levee|coastal|tsunami|high surf|rip current|seiche/i],
  ['winter', /winter|snow|blizzard|ice|freez|frost|wind chill|cold|avalanche|lake effect/i],
  ['heat', /heat/i],
  ['storm', /thunderstorm|tornado|severe|hail|lightning/i],
  ['wind', /wind|gale|dust|blowing/i],
  ['marine', /marine|small craft|gale|hazardous seas|brisk wind|sea/i],
  ['air', /air quality|air stagnation|ozone|particulate/i],
];

export function alertCategory(event: string): AlertCategory {
  for (const [category, re] of RULES) if (re.test(event)) return category;
  return 'other';
}
