/** Parse the optional prefill query (from the public map's "Add as Watch Location"). */
export function parseWizardParams(params: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]?.[0] : params[k]) ?? undefined;
  const lat = Number(one('lat'));
  const lng = Number(one('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    latitude: lat,
    longitude: lng,
    label: one('label')?.slice(0, 60),
    city_name: one('city') || undefined,
    state: one('state') || undefined,
    postal_code: one('zip')?.trim().slice(0, 12) || undefined,
  };
}
