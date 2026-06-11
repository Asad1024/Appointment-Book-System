import type { LucideIcon } from 'lucide-react';
import { Building2, TrendingUp, Wallet } from 'lucide-react';

export type PlanCardId = 'free' | 'pro' | 'scale';

export type PlanCardDefinition = {
  id: PlanCardId;
  title: string;
  currency: string;
  amount: string;
  period: string;
  description: string;
  icon: LucideIcon;
  limits: string[];
};

export const PLAN_CARD_DEFINITIONS: PlanCardDefinition[] = [
  {
    id: 'free',
    title: 'Free',
    currency: 'AED',
    amount: '0',
    period: '/month',
    description: 'Get started and validate your booking flow.',
    icon: Wallet,
    limits: [
      '25 bookings / month',
      '2 staff accounts',
      '1 location',
      '5 services',
    ],
  },
  {
    id: 'pro',
    title: 'Pro',
    currency: 'AED',
    amount: '1,000',
    period: '/month',
    description: 'For fast-growing teams handling daily bookings.',
    icon: TrendingUp,
    limits: [
      '1,500 bookings / month',
      '12 staff accounts',
      '3 locations',
      '40 services',
    ],
  },
  {
    id: 'scale',
    title: 'Scale',
    currency: 'AED',
    amount: '1,500',
    period: '/month',
    description: 'Enterprise volume with priority support.',
    icon: Building2,
    limits: [
      '10,000+ bookings / month',
      'Unlimited staff',
      'Unlimited locations',
      'Unlimited services',
    ],
  },
];

export function isFeaturedPlan(planId: PlanCardId): boolean {
  return planId === 'pro';
}
