'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, CreditCard, ExternalLink, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const HISTORY_PAGE_SIZE = 10;

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
  paymentMethod: { last4: string; brand: string } | null;
  proPriceDisplay: string;
  stripeConfigured?: boolean;
  stripeCheckoutAvailable?: boolean;
  stripeProCheckoutAvailable?: boolean;
  stripeScaleCheckoutAvailable?: boolean;
  stripeWebhookUrl?: string | null;
  staffUsed?: number;
  staffLimit?: number | null;
  staffRemaining?: number | null;
  locationUsed?: number;
  locationLimit?: number | null;
  locationRemaining?: number | null;
  serviceUsed?: number;
  serviceLimit?: number | null;
  serviceRemaining?: number | null;
  planLimits?: {
    free: {
      bookingsPerMonth: number;
      staffAccounts: number | null;
      locations: number | null;
      services: number | null;
    };
    pro: {
      bookingsPerMonth: number;
      staffAccounts: number | null;
      locations: number | null;
      services: number | null;
    };
    scale: {
      bookingsPerMonth: number;
      staffAccounts: number | null;
      locations: number | null;
      services: number | null;
    };
  };
};

type BillingHistoryItem = {
  id: string;
  number: string | null;
  status: string;
  createdAt: string;
  currency: string;
  amountPaidMinor: number;
  amountDueMinor: number;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  receiptUrl: string | null;
};

type BillingHistoryResponse = {
  items: BillingHistoryItem[];
  hasMore: boolean;
};

type LimitResolutionItem = {
  id: string;
  name: string;
  enabled: boolean;
  suspended: boolean;
  isActive?: boolean;
  email?: string;
  role?: string;
  locationName?: string | null;
};

type LimitResolutionSection = {
  limit: number | null;
  total: number;
  enabledCount: number;
  overLimitCount: number;
  enabledIds: string[];
  items: LimitResolutionItem[];
};

type LimitResolutionState = {
  plan: string;
  locations: LimitResolutionSection;
  services: LimitResolutionSection;
  staff: LimitResolutionSection;
  hasOverages: boolean;
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

function formatLimit(limit: number | null | undefined): string {
  if (limit == null) return 'Unlimited';
  return String(limit);
}

function historyLabel(item: BillingHistoryItem): string {
  if (!item.number) return 'Record';
  if (item.status === 'downgraded') return item.number;
  return `Invoice ${item.number}`;
}

function resolveItemClass(isSuspended: boolean, isSelected: boolean): string {
  return cn(
    'flex items-start gap-2 rounded-md border px-2 py-2 text-sm',
    isSuspended
      ? 'border-amber-300 bg-amber-50/70 dark:border-amber-700/70 dark:bg-amber-950/20'
      : 'border-slate-200 dark:border-slate-800',
    isSelected && 'ring-1 ring-brand-200 dark:ring-brand-800/60',
  );
}

export function BillingCard() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [planLimitsOpen, setPlanLimitsOpen] = useState(false);
  const [limitState, setLimitState] = useState<LimitResolutionState | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const applyLimitState = useCallback((limits: LimitResolutionState | null) => {
    setLimitState(limits);
    if (limits) {
      setSelectedLocationIds(limits.locations.enabledIds);
      setSelectedServiceIds(limits.services.enabledIds);
      setSelectedStaffIds(limits.staff.enabledIds);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billingData, historyData, limits] = await Promise.all([
        apiAuth<BillingInfo>('/billing'),
        apiAuth<BillingHistoryResponse>('/billing/history').catch(() => ({
          items: [],
          hasMore: false,
        })),
        apiAuth<LimitResolutionState>('/billing/limits').catch(() => null),
      ]);
      setBilling(billingData);
      setHistory(historyData.items);
      setHistoryHasMore(historyData.hasMore);
      applyLimitState(limits);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, [applyLimitState]);

  const ensureLimitState = useCallback(async () => {
    if (limitState) return limitState;
    const limits = await apiAuth<LimitResolutionState>('/billing/limits').catch(() => null);
    applyLimitState(limits);
    return limits;
  }, [applyLimitState, limitState]);

  const openResolveDialog = useCallback(async () => {
    const limits = await ensureLimitState();
    if (!limits?.hasOverages) {
      toast.message('No suspended items to resolve right now');
      return;
    }
    setResolveOpen(true);
  }, [ensureLimitState]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setHistoryPage(1);
  }, [history]);

  useEffect(() => {
    const result = searchParams.get('billing');
    if (!result) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('billing');
    const nextQuery = nextParams.toString();
    window.history.replaceState({}, '', nextQuery ? `/admin/settings?${nextQuery}` : '/admin/settings');

    if (result === 'success') {
      toast.success('Pro subscription activated', { id: 'billing-checkout-success' });
      void load();
      return;
    }
    if (result === 'cancel') {
      toast.message('Checkout cancelled', { id: 'billing-checkout-cancel' });
    }
  }, [searchParams, load]);

  useEffect(() => {
    const onOpenResolve = () => {
      void openResolveDialog();
    };
    window.addEventListener('slotwise:open-resolve-limits', onOpenResolve);
    return () => window.removeEventListener('slotwise:open-resolve-limits', onOpenResolve);
  }, [openResolveDialog]);

  useEffect(() => {
    if (searchParams.get('resolveLimits') !== '1') return;

    void openResolveDialog();

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('resolveLimits');
    const nextQuery = nextParams.toString();
    window.history.replaceState({}, '', nextQuery ? `/admin/settings?${nextQuery}` : '/admin/settings');
  }, [searchParams, openResolveDialog]);

  async function startStripeCheckout() {
    setCheckoutLoading(true);
    try {
      const preferredPlan =
        billing?.stripeProCheckoutAvailable
          ? 'pro'
          : billing?.stripeScaleCheckoutAvailable
            ? 'scale'
            : 'pro';
      const query = new URLSearchParams({
        plan: preferredPlan,
        returnTo: '/admin/settings?tab=billing',
      });
      const { url } = await apiAuth<{ url: string }>(`/billing/checkout?${query.toString()}`, {
        method: 'POST',
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
      setCheckoutLoading(false);
    }
  }

  function toggleSelection(
    id: string,
    selected: string[],
    setSelected: (value: string[]) => void,
    limit: number | null,
  ) {
    const exists = selected.includes(id);
    if (exists) {
      setSelected(selected.filter((item) => item !== id));
      return;
    }
    if (limit != null && selected.length >= limit) {
      toast.error(`You can select up to ${limit}`);
      return;
    }
    setSelected([...selected, id]);
  }

  async function saveLimitSelections() {
    setSavingLimits(true);
    try {
      const updated = await apiAuth<LimitResolutionState>('/billing/limits', {
        method: 'POST',
        body: JSON.stringify({
          locationIds: selectedLocationIds,
          serviceIds: selectedServiceIds,
          staffUserIds: selectedStaffIds,
        }),
      });
      setLimitState(updated);
      setSelectedLocationIds(updated.locations.enabledIds);
      setSelectedServiceIds(updated.services.enabledIds);
      setSelectedStaffIds(updated.staff.enabledIds);
      setResolveOpen(false);
      window.dispatchEvent(new CustomEvent('slotwise:limits-updated'));
      toast.success('Active items updated');
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save active items');
    } finally {
      setSavingLimits(false);
    }
  }

  if (loading) {
    return <Skeleton className="mb-8 h-72 w-full rounded-xl" />;
  }

  if (!billing) return null;

  const atLimit = billing.remaining <= 0;
  const useStripe = Boolean(billing.stripeConfigured || billing.stripeCheckoutAvailable);
  const showRenewWarning = billing.inGracePeriod || billing.accessBlocked;
  const currentPaidPlanLabel =
    billing.plan === 'scale' ? 'Scale' : billing.plan === 'pro' ? 'Pro' : 'Paid';
  const usageRows = [
    {
      label: 'Bookings this month',
      used: billing.monthlyUsed,
      limit: billing.monthlyLimit,
      remaining: billing.remaining,
    },
    {
      label: 'Staff accounts',
      used: billing.staffUsed ?? 0,
      limit: billing.staffLimit,
      remaining: billing.staffRemaining,
    },
    {
      label: 'Locations',
      used: billing.locationUsed ?? 0,
      limit: billing.locationLimit,
      remaining: billing.locationRemaining,
    },
    {
      label: 'Services',
      used: billing.serviceUsed ?? 0,
      limit: billing.serviceLimit,
      remaining: billing.serviceRemaining,
    },
  ];
  const planLimits = billing.planLimits ?? {
    free: {
      bookingsPerMonth: 25,
      staffAccounts: 2,
      locations: 1,
      services: 5,
    },
    pro: {
      bookingsPerMonth: 1500,
      staffAccounts: 12,
      locations: 3,
      services: 40,
    },
    scale: {
      bookingsPerMonth: 10000,
      staffAccounts: null,
      locations: null,
      services: null,
    },
  };
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historyStartIndex = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const visibleHistory = history.slice(historyStartIndex, historyStartIndex + HISTORY_PAGE_SIZE);
  const historyEndIndex = Math.min(history.length, historyStartIndex + visibleHistory.length);

  return (
    <Card className={cn('mb-8', atLimit && !billing.proActive && 'border-amber-200 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20')}>
      <CardBody>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Subscription & billing</h2>
              <p className="text-sm text-text-secondary">
                {useStripe
                  ? 'Plans are billed via Stripe Checkout (AED).'
                  : 'Configure Stripe keys and plan IDs to enable live checkout.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                billing.proActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : showRenewWarning
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              {billing.proActive
                ? `${currentPaidPlanLabel} active`
                : billing.accessBlocked
                  ? 'Renew required'
                  : billing.inGracePeriod
                    ? 'Payment overdue'
                    : 'Free plan'}
            </span>
            <Link href="/upgrade">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-brand-500 bg-white text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:bg-slate-950 dark:text-brand-200 dark:hover:bg-brand-950/35"
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Upgrade
              </Button>
            </Link>
          </div>
        </div>

        {billing.proActive || billing.inGracePeriod ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4" />
              {billing.inGracePeriod
                ? 'Payment overdue - grace period active'
                : `${currentPaidPlanLabel} plan active`}
            </p>
            {billing.paymentMethod && (
              <p className="mt-1 text-emerald-800/90 dark:text-emerald-300/90">
                Card on file ...{billing.paymentMethod.last4} ({billing.paymentMethod.brand})
              </p>
            )}
            {billing.subscriptionExpiresAt && (
              <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
                {billing.inGracePeriod ? 'Grace ends' : 'Renews'}{' '}
                {new Date(billing.subscriptionExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : useStripe ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">
              Upgrade to Pro - {billing.proPriceDisplay}
            </p>
            <Button type="button" loading={checkoutLoading} onClick={() => void startStripeCheckout()}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Subscribe with Stripe
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text-secondary dark:border-slate-800 dark:bg-slate-900/40">
            Live Stripe checkout is not configured yet.
          </div>
        )}

        <div className="mt-6 w-full rounded-xl bg-white/70 px-0 py-4 dark:bg-slate-950/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Payment history</h3>
            <span className="text-xs text-text-muted">
              {history.length === 0
                ? 'No records'
                : `Showing ${historyStartIndex + 1}-${historyEndIndex} of ${history.length}`}
              {historyHasMore ? ' (latest loaded)' : ''}
            </span>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-text-secondary">No Stripe invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 text-text-secondary dark:bg-slate-900/70">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                  {visibleHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-text-secondary">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {historyLabel(item)}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{item.status}</td>
                      <td className="px-3 py-2 font-semibold text-text-primary">
                        {formatMinorAmount(item.amountPaidMinor, item.currency)}
                      </td>
                      <td className="px-3 py-2 text-right">
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
                        ) : (
                          <span className="text-xs text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {history.length > HISTORY_PAGE_SIZE ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentHistoryPage <= 1}
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: totalHistoryPages }, (_, index) => index + 1).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  type="button"
                  size="sm"
                  variant={pageNumber === currentHistoryPage ? 'default' : 'outline'}
                  onClick={() => setHistoryPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentHistoryPage >= totalHistoryPages}
                onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 w-full rounded-xl bg-white/70 px-0 py-4 dark:bg-slate-950/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Plan limitations</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Bookings, staff accounts, locations, and services limits.
              </p>
              {limitState?.hasOverages ? (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Some items are suspended on your current plan. Choose which ones stay active.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {limitState?.hasOverages ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  onClick={() => setResolveOpen(true)}
                >
                  Resolve limits
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-brand-500 bg-white text-brand-700 hover:bg-brand-50 dark:border-brand-500 dark:bg-slate-950 dark:text-brand-200 dark:hover:bg-brand-950/35"
                onClick={() => setPlanLimitsOpen(true)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Plan limits
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800 sm:p-5">
            <p className="text-sm font-medium text-text-primary">Current usage</p>
            <div className="mt-4 space-y-2.5">
              {usageRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 rounded-md bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/60"
                >
                  <p className="text-sm text-text-secondary">{row.label}</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {row.used} / {formatLimit(row.limit)}{' '}
                    <span className="font-normal text-text-muted">
                      ({row.remaining == null ? 'Unlimited' : `${row.remaining} left`})
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Resolve suspended items</DialogTitle>
              <DialogDescription>
                Pick which locations, services, and staff accounts stay active on your current
                plan.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p
                  className={cn(
                    'text-sm font-semibold text-text-primary',
                    (limitState?.locations.overLimitCount ?? 0) > 0 &&
                      'text-amber-700 dark:text-amber-300',
                  )}
                >
                  Locations ({selectedLocationIds.length} / {formatLimit(limitState?.locations.limit)})
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                  {(limitState?.locations.items ?? []).map((item) => {
                    const isSelected = selectedLocationIds.includes(item.id);
                    return (
                    <label
                      key={item.id}
                      className={resolveItemClass(item.suspended, isSelected)}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={isSelected}
                        onChange={() =>
                          toggleSelection(
                            item.id,
                            selectedLocationIds,
                            setSelectedLocationIds,
                            limitState?.locations.limit ?? null,
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-text-primary">{item.name}</span>
                      {item.suspended ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Suspended
                        </span>
                      ) : null}
                    </label>
                  );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p
                  className={cn(
                    'text-sm font-semibold text-text-primary',
                    (limitState?.services.overLimitCount ?? 0) > 0 &&
                      'text-amber-700 dark:text-amber-300',
                  )}
                >
                  Services ({selectedServiceIds.length} / {formatLimit(limitState?.services.limit)})
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                  {(limitState?.services.items ?? []).map((item) => {
                    const isSelected = selectedServiceIds.includes(item.id);
                    return (
                    <label
                      key={item.id}
                      className={resolveItemClass(item.suspended, isSelected)}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={isSelected}
                        onChange={() =>
                          toggleSelection(
                            item.id,
                            selectedServiceIds,
                            setSelectedServiceIds,
                            limitState?.services.limit ?? null,
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 text-text-primary">
                        {item.name}
                        {item.locationName ? (
                          <span className="block text-xs text-text-muted">{item.locationName}</span>
                        ) : null}
                      </span>
                      {item.suspended ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Suspended
                        </span>
                      ) : null}
                    </label>
                  );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p
                  className={cn(
                    'text-sm font-semibold text-text-primary',
                    (limitState?.staff.overLimitCount ?? 0) > 0 &&
                      'text-amber-700 dark:text-amber-300',
                  )}
                >
                  Staff ({selectedStaffIds.length} / {formatLimit(limitState?.staff.limit)})
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                  {(limitState?.staff.items ?? []).map((item) => {
                    const isSelected = selectedStaffIds.includes(item.id);
                    return (
                    <label
                      key={item.id}
                      className={resolveItemClass(item.suspended, isSelected)}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={isSelected}
                        onChange={() =>
                          toggleSelection(
                            item.id,
                            selectedStaffIds,
                            setSelectedStaffIds,
                            limitState?.staff.limit ?? null,
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 text-text-primary">
                        {item.name}
                        <span className="block text-xs text-text-muted">
                          {item.email} {item.role ? `- ${item.role.replace(/_/g, ' ')}` : ''}
                        </span>
                      </span>
                      {item.suspended ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Suspended
                        </span>
                      ) : null}
                    </label>
                  );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResolveOpen(false)}>
                Cancel
              </Button>
              <Button type="button" loading={savingLimits} onClick={() => void saveLimitSelections()}>
                Save active items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={planLimitsOpen} onOpenChange={setPlanLimitsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Plan limits</DialogTitle>
              <DialogDescription>
                Compare booking, staff, location, and service limits for each plan.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: 'free', label: 'Free', data: planLimits.free },
                { key: 'pro', label: 'Pro', data: planLimits.pro },
                { key: 'scale', label: 'Scale', data: planLimits.scale },
              ].map((entry) => (
                <div
                  key={entry.key}
                  className={cn(
                    'rounded-xl border bg-white p-4 dark:bg-slate-900',
                    billing.plan === entry.key
                      ? 'border-brand-300 ring-1 ring-brand-100 dark:border-brand-700 dark:ring-brand-900/40'
                      : 'border-slate-200 dark:border-slate-800',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {entry.label}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-text-secondary">
                    <p>
                      <span className="font-medium text-text-primary">Bookings / month:</span>{' '}
                      {entry.data.bookingsPerMonth}
                    </p>
                    <p>
                      <span className="font-medium text-text-primary">Staff accounts:</span>{' '}
                      {formatLimit(entry.data.staffAccounts)}
                    </p>
                    <p>
                      <span className="font-medium text-text-primary">Locations:</span>{' '}
                      {formatLimit(entry.data.locations)}
                    </p>
                    <p>
                      <span className="font-medium text-text-primary">Services:</span>{' '}
                      {formatLimit(entry.data.services)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-text-secondary dark:border-slate-800 dark:bg-slate-900/60">
              When you reach a limit, upgrade your plan to keep creating bookings and resources.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanLimitsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardBody>
    </Card>
  );
}

