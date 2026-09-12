import { Badge } from '@/components/ui/badge';

/** Severity is always conveyed by text, never colour alone (UI/UX Notes §6). */
export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  const s = severity ?? 'Unknown';
  const tone = s === 'Extreme' || s === 'Severe' ? 'danger' : s === 'Moderate' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{s}</Badge>;
}

/** NWS event names end in Warning / Watch / Advisory — surface that class explicitly. */
export function alertClass(event: string): 'Warning' | 'Watch' | 'Advisory' | 'Statement' | 'Alert' {
  const lower = event.toLowerCase();
  if (lower.includes('warning')) return 'Warning';
  if (lower.includes('watch')) return 'Watch';
  if (lower.includes('advisory')) return 'Advisory';
  if (lower.includes('statement')) return 'Statement';
  return 'Alert';
}
