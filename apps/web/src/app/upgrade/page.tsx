'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, Check, CreditCard, ExternalLink, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { PageTransition } from '@/components/motion/PageTransition';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiAuth } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useStaffSession } from '@/lib/useStaffSession';

type BillingInfo = {
  plan: string;
  status: string;
  proActive: boolean;
  inGracePeriod?: boolean;
  accessBlocked?: boolean;
  monthlyLimit: number;
  monthlyUsed: number;
  remaining: number;
  subscriptionExpiresAt: string | null;
  proPriceDisplay: string;
  stripeCheckoutAvailable?: boolean;
  stripeProCheckoutAvailable?: boolean;
  stripeScaleCheckoutAvailable?: boolean;
};

type BillingHistoryItem = {
  id: string;
  number: string | null;
  status: string;
  createdAt: string;
  currency: string;
  amountPaidMinor: number;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  receiptUrl: string | null;
};

type BillingHistoryResponse = {
  items: BillingHistoryItem[];
  hasMore: boolean;
};

function formatMinorAmount(minor: number, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

function historyLabel(item: BillingHistoryItem): string {
  if (!item.number) return 'Record';
  if (item.status === 'downgraded') return item.number;
  return `Invoice ${item.number}`;
}

const PLAN_CARDS = [
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
] as const;

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const { user, loading, isOrgAdmin } = useStaffSession();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [checkoutPlanLoading, setCheckoutPlanLoading] = useState<'pro' | 'scale' | null>(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const dashboardHref = useMemo(() => {
    if (user?.role === 'provider') return '/provider/dashboard';
    return '/admin/dashboard';
  }, [user?.role]);
  const returnToBillingHref = '/admin/settings?tab=billing';

  const load = useCallback(async () => {
    if (!isOrgAdmin) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    try {
      const [billingData, historyData] = await Promise.all([
        apiAuth<BillingInfo>('/billing'),
        apiAuth<BillingHistoryResponse>('/billing/history').catch(() => ({
          items: [],
          hasMore: false,
        })),
      ]);
      setBilling(billingData);
      setHistory(historyData.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load upgrade details');
    } finally {
      setDataLoading(false);
    }
  }, [isOrgAdmin]);

  useEffect(() => {
    if (!loading) {
      void load();
    }
  }, [loading, load]);

  useEffect(() => {
    const result = searchParams.get('billing');
    if (!result) return;
    if (result === 'success') {
      toast.success('Subscription updated successfully');
      void load();
    } else if (result === 'cancel') {
      toast.message('Checkout cancelled');
    }
    window.history.replaceState({}, '', '/upgrade');
  }, [searchParams, load]);

  async function startCheckout(plan: 'pro' | 'scale') {
    if (checkoutPlanLoading) return;
    setCheckoutPlanLoading(plan);
    try {
      const query = new URLSearchParams({
        returnTo: '/admin/settings?tab=billing',
        plan,
      });
      const { url } = await apiAuth<{ url: string }>(`/billing/checkout?${query.toString()}`, {
        method: 'POST',
      });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start Stripe checkout');
      setCheckoutPlanLoading(null);
    }
  }

  async function downgradeToFree() {
    if (downgradeLoading || checkoutPlanLoading) return;
    setDowngradeLoading(true);
    try {
      const updated = await apiAuth<BillingInfo>('/billing/downgrade', { method: 'POST' });
      setBilling(updated);
      toast.success('Plan downgraded to Free');
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not downgrade plan');
    } finally {
      setDowngradeLoading(false);
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <Logo href={dashboardHref} />
            <Link href={returnToBillingHref}>
              <Button
                type="button"
                className="bg-brand-600 text-white shadow-sm hover:bg-brand-700"
              >
                Return to billing
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-6 px-3 py-6 sm:px-4 sm:py-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">
              Upgrade Plans
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Compare plans, upgrade with Stripe, and review billing usage.
            </p>
          </div>

          {!loading && !isOrgAdmin ? (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardBody className="p-5 sm:p-6">
                <p className="text-sm text-text-secondary">
                  Only organization admins can manage subscription upgrades.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Tabs defaultValue="plans" className="space-y-4">
              <TabsList className="h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <TabsTrigger
                  value="plans"
                  className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                >
                  Plans
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white"
                >
                  Billing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plans" className="mt-0">
                <div className="grid gap-5 lg:grid-cols-3">
                  {PLAN_CARDS.map((plan) => {
                    const Icon = plan.icon;
                    const isPro = plan.id === 'pro';
                    const isScale = plan.id === 'scale';
                    const hasPaidPlan = Boolean(billing?.proActive || billing?.inGracePeriod);
                    const currentPaidPlan =
                      billing?.plan === 'scale' ? 'scale' : billing?.plan === 'pro' ? 'pro' : null;
                    const isCurrent =
                      plan.id === 'free'
                        ? !hasPaidPlan
                        : hasPaidPlan && currentPaidPlan === plan.id;
                    const anyPlanActionLoading = checkoutPlanLoading !== null || downgradeLoading;
                    return (
                      <div key={plan.id} className="relative pt-8">
                        {isPro ? (
                          <span className="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
                            Most popular
                          </span>
                        ) : null}
                        <Card
                          className={cn(
                            'group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900',
                            isPro
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
                                  <Check className="h-4 w-4 text-emerald-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>

                            <div className="mt-auto pt-10">
                              {isPro ? (
                                <Button
                                  type="button"
                                  className="h-12 w-full text-base font-semibold"
                                  variant={isCurrent ? 'outline' : 'default'}
                                  loading={checkoutPlanLoading === 'pro'}
                                  disabled={isCurrent || anyPlanActionLoading}
                                  onClick={() => void startCheckout('pro')}
                                >
                                  <CreditCard className="h-4 w-4" />
                                  {isCurrent ? 'Current plan' : 'Subscribe'}
                                </Button>
                              ) : isScale ? (
                                <Button
                                  type="button"
                                  className="h-12 w-full text-base"
                                  variant="outline"
                                  loading={checkoutPlanLoading === 'scale'}
                                  disabled={isCurrent || anyPlanActionLoading}
                                  onClick={() => void startCheckout('scale')}
                                >
                                  <CreditCard className="h-4 w-4" />
                                  {isCurrent ? 'Current plan' : 'Subscribe'}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  className="h-12 w-full text-base"
                                  variant="outline"
                                  loading={downgradeLoading}
                                  disabled={isCurrent || anyPlanActionLoading}
                                  onClick={() => void downgradeToFree()}
                                >
                                  {isCurrent ? 'Current plan' : 'Downgrade'}
                                </Button>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="billing" className="mt-0 space-y-4">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardBody className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-semibold text-text-primary">Usage</h2>
                    {dataLoading || !billing ? (
                      <p className="mt-2 text-sm text-text-secondary">Loading usage...</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-text-secondary">
                          Current plan:{' '}
                          <strong>
                            {billing.plan === 'scale'
                              ? 'Scale'
                              : billing.plan === 'pro'
                                ? 'Pro'
                                : 'Free'}
                          </strong>
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Monthly usage: <strong>{billing.monthlyUsed}</strong> / {billing.monthlyLimit}
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((billing.monthlyUsed / Math.max(1, billing.monthlyLimit)) * 100),
                              )}%`,
                            }}
                          />
                        </div>
                      </>
                    )}
                  </CardBody>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardBody className="p-5 sm:p-6">
                    <h2 className="font-display text-lg font-semibold text-text-primary">Purchases</h2>
                    {dataLoading ? (
                      <p className="mt-2 text-sm text-text-secondary">Loading purchases...</p>
                    ) : history.length === 0 ? (
                      <p className="mt-2 text-sm text-text-secondary">No invoice history yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {history.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                          >
                            <div>
                              <p className="text-sm font-medium text-text-primary">
                                {historyLabel(item)}
                              </p>
                              <p className="text-xs text-text-muted">
                                {new Date(item.createdAt).toLocaleDateString()} - {item.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-text-primary">
                                {formatMinorAmount(item.amountPaidMinor, item.currency)}
                              </p>
                              {item.receiptUrl ? (
                                <a
                                  href={item.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-text-primary hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                  Receipt
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : item.invoicePdfUrl ? (
                                <a
                                  href={item.invoicePdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-text-primary hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                  PDF
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : item.hostedInvoiceUrl ? (
                                <a
                                  href={item.hostedInvoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-text-primary hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                  Invoice
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
