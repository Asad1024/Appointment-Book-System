import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', {
  variants: {
    variant: {
      default: 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      brand: 'border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800/70 dark:bg-brand-950/40 dark:text-brand-300',
      confirmed: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200',
      pending: 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200',
      cancelled: 'border border-red-200 bg-red-50 text-red-600 dark:border-red-800/70 dark:bg-red-950/35 dark:text-red-200',
      checked_in: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/35 dark:text-blue-200',
      completed: 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      no_show: 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/35 dark:text-rose-200',
      success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200',
      warning: 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200',
      danger: 'border border-red-200 bg-red-50 text-red-600 dark:border-red-800/70 dark:bg-red-950/35 dark:text-red-200',
    },
  },
  defaultVariants: { variant: 'default' },
});

const toneToVariant: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
  default: 'default',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: keyof typeof toneToVariant;
}

export function Badge({ className, variant, tone, ...props }: BadgeProps) {
  const resolved = variant ?? (tone ? toneToVariant[tone] : 'default');
  return <span className={cn(badgeVariants({ variant: resolved }), className)} {...props} />;
}

export { badgeVariants };
