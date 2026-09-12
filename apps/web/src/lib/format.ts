export function formatTemp(f: number | null | undefined): string {
  return f === null || f === undefined ? '—' : `${Math.round(f)}°F`;
}

export function formatDateTime(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...opts });
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatHour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric' });
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString();
}

export function placeLine(location: { city_name: string | null; state: string | null }): string {
  return [location.city_name, location.state].filter(Boolean).join(', ');
}
