'use client';

import { useEffect, useState } from 'react';
import { CustomerTenantLanding } from '@/components/landing/CustomerTenantLanding';
import { OrganizationNotFound } from '@/components/landing/OrganizationNotFound';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPublicOrganization } from '@/lib/public-org';

type GateState =
  | { status: 'loading' }
  | { status: 'ready'; organizationName: string }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export function TenantOrgGate({
  orgSlug,
  orgFromQuery,
}: {
  orgSlug: string;
  orgFromQuery: string;
}) {
  const [state, setState] = useState<GateState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetchPublicOrganization(orgSlug)
      .then((organization) => {
        if (cancelled) return;
        if (!organization) {
          setState({ status: 'not_found' });
          return;
        }
        setState({ status: 'ready', organizationName: organization.name });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: 'unavailable' });
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-14 sm:px-6 sm:py-16" aria-busy aria-label="Loading">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="mt-8 flex gap-3">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-44" />
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state.status === 'not_found') {
    return <OrganizationNotFound slug={orgSlug} />;
  }

  if (state.status === 'unavailable') {
    return <OrganizationNotFound slug={orgSlug} unavailable />;
  }

  return (
    <CustomerTenantLanding
      orgSlug={orgSlug}
      orgFromQuery={orgFromQuery}
      organizationName={state.organizationName}
    />
  );
}
