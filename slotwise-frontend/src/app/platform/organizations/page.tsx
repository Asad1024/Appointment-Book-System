'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShell } from '@/components/admin/StaffPageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  appointmentCount: number;
  userCount: number;
  bookingUrl: string;
};

type ListResponse = { data: OrgRow[]; total: number };

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const scopeQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' });
    for (const key of ['search', 'status', 'orgId']) {
      const value = searchParams.get(key);
      if (value?.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [searchParams]);

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiAuth<ListResponse>(`/platform/organizations?${scopeQuery}`);
      setRows(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (search.trim()) params.set('search', search.trim());
    else params.delete('search');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  async function toggleActive(org: OrgRow) {
    try {
      await apiAuth(`/platform/organizations/${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      toast.success(org.isActive ? 'Organization suspended' : 'Organization activated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <PageTransition>
      <StaffPageShell
        title="Organizations"
        description={`${total} tenant${total === 1 ? '' : 's'} on the platform — self-service signups and demos.`}
      >
        <div className="space-y-6">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="search"
                  className="pl-9"
                  placeholder="Company name or slug"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                />
              </div>
            </div>
            <Button type="button" onClick={applySearch}>
              Search
            </Button>
          </CardBody>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-text-secondary">
              No organizations found.
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((org) => (
              <Card key={org.id} className={cn('border-slate-200 dark:border-slate-800', !org.isActive && 'opacity-75')}>
                <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/platform/organizations/${org.id}`}
                        className="font-display text-lg font-semibold text-text-primary hover:text-brand-600"
                      >
                        {org.name}
                      </Link>
                      <StatusBadge status={org.isActive ? 'confirmed' : 'cancelled'} />
                      <span className="text-xs text-text-muted">/{org.slug}</span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {org.appointmentCount} appointments · {org.userCount} users · {org.subscriptionPlan}{' '}
                      ({org.subscriptionStatus})
                    </p>
                    <a
                      href={org.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                    >
                      Booking URL
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={`/platform/organizations/${org.id}`}>Details</Link>
                    </Button>
                    <Button
                      type="button"
                      variant={org.isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => void toggleActive(org)}
                    >
                      {org.isActive ? 'Suspend' : 'Activate'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
        </div>
      </StaffPageShell>
    </PageTransition>
  );
}
