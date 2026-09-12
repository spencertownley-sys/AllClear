import * as React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + inline error, per UI/UX Notes §5 (errors directly below the field). */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-alert-foreground">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
