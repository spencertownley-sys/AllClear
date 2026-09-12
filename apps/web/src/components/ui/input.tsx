import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex min-h-11 w-full rounded-control border bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        invalid ? 'border-alert' : 'border-slate-300',
        className,
      )}
      {...props}
    />
  );
}
