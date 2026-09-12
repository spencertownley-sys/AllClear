import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Reassuring (good) vs neutral tone. */
  tone?: 'neutral' | 'good';
}

/** Never a blank gap (UI/UX Notes §3): every section has a reassuring empty state. */
export function EmptyState({ icon, title, description, action, className, tone = 'neutral' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-8 text-center',
        tone === 'good' ? 'border-good/30 bg-good-soft/40' : 'border-slate-300 bg-slate-50',
        className,
      )}
    >
      {icon ? <div className={cn('mb-1', tone === 'good' ? 'text-good' : 'text-slate-400')}>{icon}</div> : null}
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
