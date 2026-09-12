import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 py-2 select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
        secondary: 'bg-primary-soft text-primary hover:bg-primary/15',
        outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100',
        destructive: 'bg-alert text-white hover:bg-red-700',
        link: 'text-primary underline-offset-4 hover:underline min-h-0 px-0 py-0',
      },
      size: {
        default: 'min-h-11 px-4',
        sm: 'min-h-9 px-3 text-sm',
        lg: 'min-h-12 px-6 text-base',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}

export { buttonVariants };
