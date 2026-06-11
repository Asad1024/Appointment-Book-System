'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookingWizard } from '@/components/BookingWizard';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { PageTransition } from '@/components/motion/PageTransition';
import { CustomerLayout } from '@/components/shells/CustomerLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveOrgContext, withTenantPath } from '@/lib/resolve-org-slug';
import { useAuthUser } from '@/lib/useAuthUser';
import { useCustomerLogout } from '@/lib/useCustomerLogout';

function orgLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function BookContent() {
  const search = useSearchParams();
  const pathname = usePathname();
  const org = resolveOrgContext(search, pathname).slug;
  if (!org) {
    return <OrgRequiredGate />;
  }
  return (
    <BookingWizard
      params={{
        org,
        product: search.get('product') ?? undefined,
        locationId: search.get('location') ?? search.get('locationId') ?? undefined,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        handoffKey: search.get('handoff') ?? undefined,
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

function CustomerBookingPage({ orgLabel }: { orgLabel?: string }) {
  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-[1360px] space-y-4">
        <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {orgLabel ? `Book with ${orgLabel}` : 'Schedule your session'}
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

function PublicBookingPage({
  orgSlug,
  orgLabel,
}: {
  orgSlug: string;
  orgLabel?: string;
}) {
  const customerLoginHref = withTenantPath('/customer/login', orgSlug);
  const customerRegisterHref = withTenantPath('/register', orgSlug);

  return (
    <PageShell wide className="pt-8 sm:pt-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
          {orgLabel ? `Book with ${orgLabel}` : 'Schedule your session'}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Customer booking portal. Choose a service, pick your expert, and confirm a time - it only
          takes a minute.
        </p>
        {orgLabel ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Link href={customerLoginHref} className="font-medium text-brand-600 hover:underline">
              Customer sign in
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link href={customerRegisterHref} className="font-medium text-brand-600 hover:underline">
              Create customer account
            </Link>
          </div>
        ) : null}
      </div>
      <Suspense fallback={<BookingLoader />}>
        <BookContent />
      </Suspense>
    </PageShell>
  );
}

export default function BookPage() {
  const search = useSearchParams();
  const pathname = usePathname();
  const orgContext = resolveOrgContext(search, pathname);
  const orgSlug = orgContext.slug;
  const orgLabel = orgSlug ? orgLabelFromSlug(orgSlug) : '';
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
        <CustomerBookingPage orgLabel={orgLabel} />
      </CustomerLayout>
    );
  }

  return <PublicBookingPage orgSlug={orgSlug} orgLabel={orgLabel} />;
}
