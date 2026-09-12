import { SOURCE_LABELS, relativeTime, type HazardSource } from '@allclear/shared';
import { cn } from '@/lib/utils';

interface SourceLabelProps {
  source: HazardSource;
  fetchedAt?: string | null;
  stale?: boolean;
  className?: string;
}

/** Every card names its data origin (PRD §1.3). */
export function SourceLabel({ source, fetchedAt, stale, className }: SourceLabelProps) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 text-xs text-slate-500', className)}>
      <span>
        Source: <span className="font-medium text-slate-600">{SOURCE_LABELS[source]}</span>
      </span>
      {fetchedAt ? (
        <span className={cn(stale && 'text-accent-foreground')}>
          · updated {relativeTime(fetchedAt)}
          {stale ? ' (may be stale)' : ''}
        </span>
      ) : null}
    </span>
  );
}
