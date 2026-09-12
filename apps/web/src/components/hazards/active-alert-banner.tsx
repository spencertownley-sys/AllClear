import { AlertTriangle } from 'lucide-react';
import type { OfficialAlertDTO } from '@allclear/shared';

/** Compact, prominent pointer to active official alerts at the top of Location Detail. */
export function ActiveAlertBanner({ alerts }: { alerts: OfficialAlertDTO[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0]!;
  const danger = top.severity === 'Extreme' || top.severity === 'Severe' || /warning/i.test(top.event);
  return (
    <a
      href="#official-alerts"
      className={
        danger
          ? 'flex items-center gap-3 rounded-card border border-alert/40 bg-alert-soft px-4 py-3 text-sm font-medium text-alert-foreground'
          : 'flex items-center gap-3 rounded-card border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-medium text-accent-foreground'
      }
    >
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
      <span>
        {top.event} in effect{alerts.length > 1 ? ` and ${alerts.length - 1} more alert${alerts.length > 2 ? 's' : ''}` : ''} — see Official Alerts below.
      </span>
    </a>
  );
}
