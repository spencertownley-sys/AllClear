import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-slate-200 bg-slate-100 text-slate-700',
        primary: 'border-primary/20 bg-primary-soft text-primary',
        good: 'border-good/20 bg-good-soft text-good-foreground',
        warning: 'border-accent/30 bg-accent-soft text-accent-foreground',
        danger: 'border-alert/30 bg-alert-soft text-alert-foreground',
        purple: 'border-purple-300 bg-purple-100 text-purple-900',
        maroon: 'border-rose-300 bg-rose-100 text-rose-950',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
