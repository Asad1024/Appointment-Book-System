'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  CreditCard,
  PauseCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth, ensureCsrf } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShellFlush } from '@/components/admin/StaffPageShell';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Overview = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  appointmentsThisMonth: number;
  totalAppointments: number;
  proSubscriptions: number;
  freeOrInactive: number;
  recentOrganizations: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
  }[];
};

const statCards = [
  {
    key: 'totalOrganizations' as const,
    label: 'Organizations',
    helper: 'All tenants on platform',
    icon: Building2,
    valueClass: 'text-text-primary',
    iconClass:
      'border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/35 dark:text-brand-200',
  },
  {
    key: 'activeOrganizations' as const,
    label: 'Active',
    helper: 'Accepting bookings',
    icon: Sparkles,
    valueClass: 'text-emerald-700',
    iconClass:
      'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
  {
    key: 'appointmentsThisMonth' as const,
    label: 'Bookings this month',
    helper: 'Across all tenants',
    icon: CalendarCheck2,
    valueClass: 'text-text-primary',
    iconClass:
      'border border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  },
  {
    key: 'proSubscriptions' as const,
    label: 'Pro plans',
    helper: 'Active subscriptions',
    icon: CreditCard,
    valueClass: 'text-indigo-700',
    iconClass:
      'border border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
  },
];

export default function PlatformDashboardPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
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
        await apiAuth<Overview>(
          `/platform/overview${scopeQuery ? `?${scopeQuery}` : ''}`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resetPlatformData() {
    if (resetText !== 'RESET_ALL_DATA' || resetting) return;
    setResetting(true);
    try {
      await ensureCsrf();
      const result = await apiAuth<{
        ok: boolean;
        removed: {
          organizations: number;
          users: number;
        };
      }>('/platform/reset-all', {
        method: 'POST',
        body: JSON.stringify({ confirmText: resetText }),
      });
      toast.success(
        `Reset complete: removed ${result.removed.organizations} orgs and ${result.removed.users} users.`,
      );
      setResetOpen(false);
      setResetText('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <PageTransition>
      <StaffPageShellFlush
        title="Dashboard"
        description="Overview of all organizations on Slotwise."
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
              Reset Platform Data
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/platform/organizations">
                View all organizations
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            const value = data?.[card.key] ?? 0;
            return (
              <Card key={card.key} className="border-slate-200 shadow-sm dark:border-slate-800">
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        {card.label}
                      </p>
                      {loading ? (
                        <Skeleton className="mt-2 h-9 w-16" />
                      ) : (
                        <p className={cn('mt-2 font-display text-3xl font-bold', card.valueClass)}>
                          <AnimatedCounter value={value} />
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">{card.helper}</p>
                    </div>
                    <div className={cn('rounded-xl p-2.5', card.iconClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="p-5">
              <h2 className="font-display text-lg font-semibold text-text-primary">Quick links</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/platform/organizations"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-text-primary transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                >
                  Manage organizations
                </Link>
                <Link
                  href="/platform/payments"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-text-primary transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                >
                  Subscription & payments
                </Link>
                <Link
                  href="/platform/reports"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-text-primary transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                >
                  Platform reports
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-brand-600 transition hover:bg-brand-50/50 dark:border-slate-600"
                >
                  Preview business signup
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Recent organizations
                </h2>
                {!loading && data && data.suspendedOrganizations > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <PauseCircle className="h-3.5 w-3.5" />
                    {data.suspendedOrganizations} suspended
                  </span>
                ) : null}
              </div>
              {loading ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : !data?.recentOrganizations.length ? (
                <p className="mt-4 text-sm text-text-secondary">No organizations yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentOrganizations.map((org) => (
                    <li key={org.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0">
                        <Link
                          href={`/platform/organizations/${org.id}`}
                          className="font-medium text-text-primary hover:text-brand-600"
                        >
                          {org.name}
                        </Link>
                        <p className="text-xs text-text-muted">/{org.slug}</p>
                      </div>
                      <StatusBadge status={org.isActive ? 'confirmed' : 'cancelled'} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {!loading && data ? (
          <p className="text-center text-xs text-text-muted">
            {data.totalAppointments.toLocaleString()} total bookings · {data.freeOrInactive} free or
            inactive plans
          </p>
        ) : null}
        </div>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Reset All Tenant Data
              </DialogTitle>
              <DialogDescription>
                This permanently deletes all organizations, users, providers, services,
                customers, and appointments. Only super admin accounts remain.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                Type <span className="font-semibold">RESET_ALL_DATA</span> to confirm.
              </p>
              <Input
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                placeholder="RESET_ALL_DATA"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={resetting || resetText !== 'RESET_ALL_DATA'}
                onClick={() => void resetPlatformData()}
              >
                {resetting ? 'Resetting...' : 'Delete Everything'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </StaffPageShellFlush>
    </PageTransition>
  );
}
