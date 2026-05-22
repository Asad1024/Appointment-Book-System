'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShell } from '@/components/admin/StaffPageShell';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';

type PaymentsSummary = {
  totalOrganizations: number;
  proActive: number;
  free: number;
  organizations: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    plan: string;
    status: string;
    subscriptionExpiresAt: string | null;
    paymentMethod: { last4: string; brand: string } | null;
    hasStripeCustomer: boolean;
    hasStripeSubscription: boolean;
  }[];
};

export default function PlatformPaymentsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const scopeQuery = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of ['orgId', 'search', 'status']) {
      const value = searchParams.get(key);
      if (value?.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await apiAuth<PaymentsSummary>(
          `/platform/payments${scopeQuery ? `?${scopeQuery}` : ''}`,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageTransition>
      <StaffPageShell
        title="Payments"
        description="Subscription and billing status across all tenants."
      >
        <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total tenants', value: data?.totalOrganizations, icon: CreditCard },
            { label: 'Pro active', value: data?.proActive, icon: Sparkles, accent: true },
            { label: 'Free / other', value: data?.free, icon: CreditCard },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-slate-200 dark:border-slate-800">
                <CardBody className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {stat.label}
                    </p>
                    {loading ? (
                      <Skeleton className="mt-2 h-8 w-12" />
                    ) : (
                      <p
                        className={cn(
                          'mt-1 font-display text-2xl font-bold',
                          stat.accent ? 'text-brand-600' : 'text-text-primary',
                        )}
                      >
                        <AnimatedCounter value={stat.value ?? 0} />
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                    <Icon className="h-5 w-5 text-slate-500" />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardBody className="p-0">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="font-semibold text-text-primary">By organization</h2>
            </div>
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !data?.organizations.length ? (
              <p className="p-8 text-center text-sm text-text-secondary">No organizations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted dark:border-slate-800">
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Payment method</th>
                      <th className="px-4 py-3 font-medium">Stripe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/platform/organizations/${org.id}`}
                            className="font-medium text-text-primary hover:text-brand-600"
                          >
                            {org.name}
                          </Link>
                          <p className="text-xs text-text-muted">/{org.slug}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">{org.plan}</td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              org.status === 'active' && org.isActive ? 'confirmed' : 'pending'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {org.paymentMethod
                            ? `${org.paymentMethod.brand} ···· ${org.paymentMethod.last4}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {org.hasStripeSubscription ? 'Subscribed' : org.hasStripeCustomer ? 'Customer' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
        </div>
      </StaffPageShell>
    </PageTransition>
  );
}
