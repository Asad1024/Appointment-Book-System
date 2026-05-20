'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingWizard } from '@/components/BookingWizard';
import { parseBookingPrefill } from '@/lib/booking-prefill';
import { Skeleton } from '@/components/ui/skeleton';

/** Leads Reach partner picker — minimal chrome, lead details pre-filled from query string. */
function PartnerBookContent() {
  const search = useSearchParams();
  const prefill = parseBookingPrefill(search);

  return (
    <BookingWizard
      params={{
        org: search.get('org') ?? undefined,
        product: search.get('product') ?? undefined,
        locationId: search.get('locationId') ?? search.get('location') ?? undefined,
        source: search.get('source') ?? 'partner',
        campaign: search.get('campaign') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        ref: search.get('ref') ?? undefined,
        customerName: prefill.customerName || undefined,
        customerEmail: prefill.customerEmail || undefined,
        customerPhone: prefill.customerPhone || undefined,
        partner: true,
      }}
    />
  );
}

export default function PartnerBookPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          Book an appointment
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your contact details are pre-filled from your CRM. Choose a service, provider, and time.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        }
      >
        <PartnerBookContent />
      </Suspense>
    </>
  );
}
