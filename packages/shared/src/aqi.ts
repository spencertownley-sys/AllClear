export type AqiTone =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface AqiCategory {
  tone: AqiTone;
  name: string;
  healthNote: string;
  /** Standard EPA category color (for map markers / legends). */
  epaColor: string;
}

const CATEGORIES: Array<{ max: number } & AqiCategory> = [
  {
    max: 50,
    tone: 'good',
    name: 'Good',
    healthNote: 'Air quality is satisfactory and poses little or no risk.',
    epaColor: '#00E400',
  },
  {
    max: 100,
    tone: 'moderate',
    name: 'Moderate',
    healthNote: 'Unusually sensitive people should consider limiting prolonged outdoor exertion.',
    epaColor: '#FFFF00',
  },
  {
    max: 150,
    tone: 'sensitive',
    name: 'Unhealthy for Sensitive Groups',
    healthNote: 'People with heart or lung disease, older adults and children should reduce prolonged outdoor exertion.',
    epaColor: '#FF7E00',
  },
  {
    max: 200,
    tone: 'unhealthy',
    name: 'Unhealthy',
    healthNote: 'Everyone may begin to experience health effects; sensitive groups should avoid prolonged outdoor exertion.',
    epaColor: '#FF0000',
  },
  {
    max: 300,
    tone: 'very_unhealthy',
    name: 'Very Unhealthy',
    healthNote: 'Health alert: everyone may experience more serious health effects. Avoid outdoor exertion.',
    epaColor: '#8F3F97',
  },
  {
    max: Infinity,
    tone: 'hazardous',
    name: 'Hazardous',
    healthNote: 'Emergency conditions: everyone is more likely to be affected. Stay indoors.',
    epaColor: '#7E0023',
  },
];

export function aqiCategory(aqi: number): AqiCategory {
  const value = Math.max(0, Math.round(aqi));
  const found = CATEGORIES.find((c) => value <= c.max) ?? CATEGORIES[CATEGORIES.length - 1]!;
  const { max: _max, ...category } = found;
  void _max;
  return category;
}
