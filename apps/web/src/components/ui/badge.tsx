import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-border text-foreground',
        safe: 'bg-[var(--status-safe-bg)] text-[var(--status-safe)] border border-[var(--status-safe)]/20',
        minimum: 'bg-[var(--status-minimum-bg)] text-[var(--status-minimum)] border border-[var(--status-minimum)]/20',
        critical: 'bg-[var(--status-critical-bg)] text-[var(--status-critical)] border border-[var(--status-critical)]/20',
        empty: 'bg-[var(--status-empty-bg)] text-[var(--status-empty)] border border-[var(--status-empty)]/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
