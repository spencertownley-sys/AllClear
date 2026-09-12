export interface UvCategory {
  name: string;
  tone: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy';
  advice: string;
}

/** EPA / WHO UV Index scale. */
export function uvCategory(index: number): UvCategory {
  const v = Math.max(0, Math.round(index));
  if (v <= 2) return { name: 'Low', tone: 'good', advice: 'No protection needed for most people.' };
  if (v <= 5) return { name: 'Moderate', tone: 'moderate', advice: 'Seek shade around midday; wear sunscreen.' };
  if (v <= 7) return { name: 'High', tone: 'sensitive', advice: 'Reduce time in the sun between 10am and 4pm.' };
  if (v <= 10) return { name: 'Very High', tone: 'unhealthy', advice: 'Extra protection needed; unprotected skin burns quickly.' };
  return { name: 'Extreme', tone: 'very_unhealthy', advice: 'Avoid the sun during midday hours.' };
}
