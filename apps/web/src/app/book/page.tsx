'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingWizard } from '@/components/BookingWizard';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthUser } from '@/lib/useAuthUser';

function BookContent() {
  const search = useSearchParams();
  return (
    <BookingWizard
      params={{
        org: search.get('org') ?? undefined,
        product: search.get('product') ?? undefined,
        locationId: search.get('location') ?? search.get('locationId') ?? undefined,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        embed: search.get('embed') === 'true',
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

function CustomerBookingPage() {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] space-y-4">
        <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Schedule your session
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Choose a service, pick your expert, and confirm a time.
          </p>
        </div>

        <div className="pb-2">
          <Suspense fallback={<BookingLoader />}>
            <BookContent />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}

function PublicBookingPage() {
  return (
    <PageShell wide>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
          Schedule your session
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Choose a service, pick your expert, and confirm a time - it only takes a minute.
        </p>
      </div>
      <Suspense fallback={<BookingLoader />}>
        <BookContent />
      </Suspense>
    </PageShell>
  );
}

export default function BookPage() {
  const { user, loading, signOut, isStaff } = useAuthUser();

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
      <CustomerLayout user={user} onLogout={() => void signOut()}>
        <CustomerBookingPage />
      </CustomerLayout>
    );
  }

  return <PublicBookingPage />;
}
