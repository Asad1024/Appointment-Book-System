'use client';

import { BookingWizard } from '@/components/BookingWizard';
import { FilledBooking } from '@/components/booking/FilledBooking';
import { PartnerBookingChrome } from '@/components/booking/PartnerBookingChrome';
import { PartnerBookingFooter } from '@/components/booking/PartnerBookingFooter';
import type { PartnerBookingSession } from '@/lib/partner-session';

export function PartnerBookingFromSession({ session }: { session: PartnerBookingSession }) {
  const sharedParams = {
    org: session.orgSlug,
    source: session.source ?? 'partner',
    campaign: session.campaign ?? undefined,
    returnUrl: session.returnUrl ?? undefined,
    ref: session.ref ?? undefined,
    customerName: session.customerName ?? undefined,
    customerEmail: session.customerEmail ?? undefined,
    customerPhone: session.customerPhone ?? undefined,
    partner: true as const,
  };

  return (
    <div className="flex w-full flex-col">
      <PartnerBookingChrome orgName={session.orgName} />
      {session.mode === 'calendar' && session.serviceId && session.providerId ? (
        <FilledBooking
          params={{
            ...sharedParams,
            serviceId: session.serviceId,
            providerId: session.providerId,
            leadLabel: session.leadLabel ?? undefined,
          }}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-text-secondary">
            Choose a service and provider, then pick a time.
          </p>
          <BookingWizard params={sharedParams} />
        </>
      )}
      <PartnerBookingFooter returnUrl={session.returnUrl} className="mt-4" />
    </div>
  );
}
