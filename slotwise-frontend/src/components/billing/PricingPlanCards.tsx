'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  isFeaturedPlan,
  PLAN_CARD_DEFINITIONS,
  type PlanCardDefinition,
} from '@/lib/plan-cards';

type PricingPlanCardsProps = {
  className?: string;
  renderFooter: (plan: PlanCardDefinition) => ReactNode;
};

function PlanPricingCard({
  plan,
  footer,
}: {
  plan: PlanCardDefinition;
  footer: ReactNode;
}) {
  const Icon = plan.icon;
  const featured = isFeaturedPlan(plan.id);

  return (
    <div className="relative pt-8">
      {featured ? (
        <span className="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
          Most popular
        </span>
      ) : null}
      <Card
        className={cn(
          'group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900',
          featured
            ? 'border-brand-300 ring-1 ring-brand-100 dark:border-brand-700 dark:ring-brand-900/50'
            : 'border-slate-200 dark:border-slate-800',
        )}
      >
        <CardBody className="flex min-h-[560px] flex-col p-7">
          <div className="flex min-h-[68px] items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                {plan.title}
              </p>
              <p className="mt-2 min-h-[34px] text-sm leading-6 text-text-secondary">
                {plan.description}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <Icon className="h-6 w-6 text-brand-600 dark:text-brand-300" />
            </div>
          </div>

          <div className="mt-2 flex min-h-[122px] items-end p-1">
            <div className="flex items-end gap-2">
              <span
                className={cn(
                  'pb-2 font-display text-xl font-semibold text-text-secondary',
                  !plan.currency && 'invisible',
                )}
              >
                {plan.currency || 'AED'}
              </span>
              <h2 className="font-display text-5xl font-bold leading-none tracking-tight text-text-primary sm:text-6xl">
                {plan.amount}
              </h2>
              <span
                className={cn(
                  'pb-2 text-sm font-medium text-text-secondary',
                  !plan.period && 'invisible',
                )}
              >
                {plan.period || '/month'}
              </span>
            </div>
          </div>

          <ul className="mt-9 space-y-4">
            {plan.limits.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-10">{footer}</div>
        </CardBody>
      </Card>
    </div>
  );
}

export function PricingPlanCards({ className, renderFooter }: PricingPlanCardsProps) {
  return (
    <div className={cn('grid gap-5 lg:grid-cols-3', className)}>
      {PLAN_CARD_DEFINITIONS.map((plan) => (
        <PlanPricingCard key={plan.id} plan={plan} footer={renderFooter(plan)} />
      ))}
    </div>
  );
}
