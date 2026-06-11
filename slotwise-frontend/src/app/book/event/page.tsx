'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FilledBooking } from '@/components/booking/FilledBooking';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuthUser } from '@/lib/useAuthUser';
import { useCustomerLogout } from '@/lib/useCustomerLogout';
import { parseBookingPrefill } from '@/lib/booking-prefill';
import { isPartnerFlowFromSearch } from '@/lib/partner-flow';
import { resolveOrgSlug, withTenantPath } from '@/lib/resolve-org-slug';

function EventBookContent({ partner }: { partner: boolean }) {
  const search = useSearchParams();
  const org = resolveOrgSlug(search);
  const serviceId = search.get('serviceId') ?? '';
  const providerId = search.get('providerId') ?? '';
  const prefill = parseBookingPrefill(search);

  if (!org) {
    return <OrgRequiredGate />;
  }

  if (!serviceId || !providerId) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-10 text-center">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Invalid booking link
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This link is missing a service or provider. Ask your host for a new link.
          </p>
          {!partner && (
            <Link href={withTenantPath('/book', org)} className="mt-6 inline-block">
              <Button variant="outline">Book from full schedule</Button>
            </Link>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <FilledBooking
      params={{
        org,
        serviceId,
        providerId,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        product: search.get('product') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        ref: search.get('ref') ?? undefined,
        customerName: prefill.customerName || undefined,
        customerEmail: prefill.customerEmail || undefined,
        customerPhone: prefill.customerPhone || undefined,
        initialDate: search.get('date') ?? undefined,
        initialStartUtc: search.get('startUtc') ?? undefined,
        partner,
      }}
    />
  );
}

function BookingLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
    </div>
  );
}

function PartnerEventShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white px-4 py-6 dark:bg-slate-950 sm:px-6">
      <Suspense fallback={<BookingLoader />}>{children}</Suspense>
    </div>
  );
}

function EventBookGate() {
  const search = useSearchParams();
  const partner = isPartnerFlowFromSearch(search);

  if (partner) {
    return (
      <PartnerEventShell>
        <EventBookContent partner />
      </PartnerEventShell>
    );
  }

  return <EventBookWithAuth />;
}

function CustomerEventPage() {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] pb-2">
        <Suspense fallback={<BookingLoader />}>
          <EventBookContent partner={false} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

function PublicEventPage() {
  return (
    <PageShell wide>
      <Suspense fallback={<BookingLoader />}>
        <EventBookContent partner={false} />
      </Suspense>
    </PageShell>
  );
}

function EventBookWithAuth() {
  const { user, loading, isStaff } = useAuthUser();
  const { logout } = useCustomerLogout();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (user && !isStaff) {
    return (
      <CustomerLayout user={user} onLogout={() => void logout()}>
        <CustomerEventPage />
      </CustomerLayout>
    );
  }

  return <PublicEventPage />;
}

export default function BookEventPage() {
  return (
    <Suspense fallback={<BookingLoader />}>
      <EventBookGate />
    </Suspense>
  );
}
