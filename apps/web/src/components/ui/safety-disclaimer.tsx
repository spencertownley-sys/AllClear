import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One sentence used everywhere the app shows hazard data or sets up alerts (NW-11), and in the terms. */
export const SAFETY_DISCLAIMER =
  'NimbusWatch is not an emergency alert system and is not for life-safety decisions. Data can be delayed, incomplete or wrong, and notifications can fail. In an emergency call 911 and follow instructions from local officials, Wireless Emergency Alerts and NOAA Weather Radio.';

const SHORT =
  'Not an emergency alert system. Data and notifications can be late, incomplete or wrong. In an emergency call 911 and follow local officials.';

interface SafetyDisclaimerProps {
  /** compact: one short line for tight spots; full: the whole statement. */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Life-safety notice shown next to hazard data. Informational, so it uses the teal brand and slate
 * text; red and amber stay reserved for real warnings (CLAUDE.md rule 6). Server-safe: no hooks.
 */
export function SafetyDisclaimer({ variant = 'full', className }: SafetyDisclaimerProps) {
  return (
    <aside
      aria-label="Safety notice"
      className={cn(
        'flex items-start gap-2 rounded-card border border-primary/20 bg-primary-soft text-slate-600',
        variant === 'compact' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
        className,
      )}
    >
      <Info className={cn('shrink-0 text-primary', variant === 'compact' ? 'mt-px h-4 w-4' : 'mt-0.5 h-4 w-4')} aria-hidden />
      <p>{variant === 'compact' ? SHORT : SAFETY_DISCLAIMER}</p>
    </aside>
  );
}
