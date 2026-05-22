'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { BarChart3, Building2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShell } from '@/components/admin/StaffPageShell';
import { AnimatedCounter } from '@/components/admin/AnimatedCounter';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';

type ReportsSummary = {
  periodStart: string;
  periodEnd: string;
  signupsLast30Days: number;
  appointmentsByStatus: { status: string; count: number }[];
  topOrganizationsByAppointments: {
    organizationId: string;
    organizationName: string;
    count: number;
  }[];
};

export default function PlatformReportsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReportsSummary | null>(null);
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
        await apiAuth<ReportsSummary>(
          `/platform/reports${scopeQuery ? `?${scopeQuery}` : ''}`,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalThisMonth = data?.appointmentsByStatus.reduce((s, r) => s + r.count, 0) ?? 0;

  const periodDescription = data
    ? `Activity from ${format(parseISO(data.periodStart), 'MMM d')} – ${format(parseISO(data.periodEnd), 'MMM d, yyyy')}`
    : 'Platform-wide booking and signup metrics.';

  return (
    <PageTransition>
      <StaffPageShell title="Reports" description={periodDescription}>
        <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Bookings this month
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-1 font-display text-2xl font-bold text-text-primary">
                    <AnimatedCounter value={totalThisMonth} />
                  </p>
                )}
              </div>
              <BarChart3 className="h-8 w-8 text-brand-500 opacity-80" />
            </CardBody>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  New signups (30 days)
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-12" />
                ) : (
                  <p className="mt-1 font-display text-2xl font-bold text-emerald-700">
                    <AnimatedCounter value={data?.signupsLast30Days ?? 0} />
                  </p>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500 opacity-80" />
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="p-5">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Appointments by status
              </h2>
              {loading ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !data?.appointmentsByStatus.length ? (
                <p className="mt-4 text-sm text-text-secondary">No appointments this month.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.appointmentsByStatus.map((row) => (
                    <li
                      key={row.status}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <StatusBadge status={row.status} />
                      <span className="font-semibold text-text-primary">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardBody className="p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-600" />
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Top organizations
                </h2>
              </div>
              {loading ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !data?.topOrganizationsByAppointments.length ? (
                <p className="mt-4 text-sm text-text-secondary">No data yet.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.topOrganizationsByAppointments.map((row, i) => (
                    <li
                      key={row.organizationId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-xs font-bold text-text-muted">{i + 1}</span>
                        <Link
                          href={`/platform/organizations/${row.organizationId}`}
                          className="truncate font-medium text-text-primary hover:text-brand-600"
                        >
                          {row.organizationName}
                        </Link>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-text-primary">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        </div>
      </StaffPageShell>
    </PageTransition>
  );
}
