'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { PageTransition } from '@/components/motion/PageTransition';
import { StaffPageShell } from '@/components/admin/StaffPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  bookingCurrency: string;
  appointmentCount: number;
  userCount: number;
  bookingUrl: string;
  locations: { id: string; name: string; timezone: string }[];
  adminUsers: { id: string; name: string; email: string; role: string; isActive: boolean }[];
};

export default function PlatformOrganizationPage() {
  const params = useParams();
  const id = params.id as string;
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiAuth<OrgDetail>(`/platform/organizations/${id}`);
      setOrg(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive() {
    if (!org) return;
    try {
      await apiAuth(`/platform/organizations/${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      toast.success(org.isActive ? 'Suspended' : 'Activated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <StaffPageShell title="Organization" description="Loading…">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </StaffPageShell>
      </PageTransition>
    );
  }

  if (!org) {
    return (
      <PageTransition>
        <StaffPageShell title="Organization" description="Not found">
          <p className="text-sm text-text-secondary">
            Organization not found.{' '}
            <Link href="/platform/organizations" className="text-brand-600 hover:underline">
              Back to all organizations
            </Link>
          </p>
        </StaffPageShell>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <StaffPageShell
        title={org.name}
        description={`/${org.slug}`}
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/platform/organizations">
                <ArrowLeft className="mr-1 h-4 w-4" />
                All organizations
              </Link>
            </Button>
            <Button
              type="button"
              variant={org.isActive ? 'outline' : 'default'}
              size="sm"
              onClick={() => void toggleActive()}
            >
              {org.isActive ? 'Suspend' : 'Activate'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={org.isActive ? 'confirmed' : 'cancelled'} />
          <a
            href={org.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            {org.bookingUrl}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-text-muted">Appointments</p>
              <p className="font-display text-2xl font-bold">{org.appointmentCount}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-text-muted">Users</p>
              <p className="font-display text-2xl font-bold">{org.userCount}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-text-muted">Plan</p>
              <p className="font-display text-lg font-semibold capitalize">
                {org.subscriptionPlan} · {org.subscriptionStatus}
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="space-y-4 p-4">
            <h3 className="font-semibold text-text-primary">Locations</h3>
            {org.locations.length === 0 ? (
              <p className="text-sm text-text-secondary">No locations.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {org.locations.map((loc) => (
                  <li key={loc.id} className="flex justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                    <span>{loc.name}</span>
                    <span className="text-text-muted">{loc.timezone}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4 p-4">
            <h3 className="font-semibold text-text-primary">Admins & managers</h3>
            <ul className="space-y-2 text-sm">
              {org.adminUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                  <span>
                    {u.name} · {u.email}
                  </span>
                  <span className="text-text-muted capitalize">
                    {u.role.replace(/_/g, ' ')}
                    {!u.isActive ? ' · inactive' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        </div>
      </StaffPageShell>
    </PageTransition>
  );
}
