'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FilledBooking } from '@/components/booking/FilledBooking';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { useAuthUser } from '@/lib/useAuthUser';

function SlugBookContent({
  providerSlug,
  serviceSlug,
  embed,
}: {
  providerSlug: string;
  serviceSlug: string;
  embed?: boolean;
}) {
  const search = useSearchParams();

  if (!providerSlug?.trim() || !serviceSlug?.trim()) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-10 text-center">
          <p className="font-display text-lg font-semibold">Invalid booking link</p>
          <Link href="/book" className="mt-6 inline-block">
            <Button variant="outline">Browse all booking options</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <FilledBooking
      params={{
        org: search.get('org') ?? undefined,
        providerSlug,
        serviceSlug,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        product: search.get('product') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        embed,
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

export function FilledBookingBySlugPage({
  providerSlug,
  serviceSlug,
  embed,
}: {
  providerSlug: string;
  serviceSlug: string;
  embed?: boolean;
}) {
  const { user, loading, signOut, isStaff } = useAuthUser();

  const content = (
    <Suspense fallback={<BookingLoader />}>
      <SlugBookContent providerSlug={providerSlug} serviceSlug={serviceSlug} embed={embed} />
    </Suspense>
  );

  if (embed) {
    return <div className="min-h-screen bg-white p-4 dark:bg-slate-950 sm:p-6">{content}</div>;
  }

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
        <PageTransition>
          <div className="mx-auto w-full max-w-[1360px] pb-2">{content}</div>
        </PageTransition>
      </CustomerLayout>
    );
  }

  return (
    <PageShell wide>
      <PageTransition>{content}</PageTransition>
    </PageShell>
  );
}
