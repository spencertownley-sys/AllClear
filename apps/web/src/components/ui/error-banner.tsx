'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Human-readable, isolated error state with a retry (UI/UX Notes §3). */
export function ErrorBanner({ message, onRetry, className, compact }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/40 bg-accent-soft text-accent-foreground',
        compact ? 'px-3 py-2 text-sm' : 'px-4 py-3',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {message}
      </span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Retry
        </Button>
      ) : null}
    </div>
  );
}
