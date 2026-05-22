'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FilledBooking } from '@/components/booking/FilledBooking';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { resolveOrgSlug } from '@/lib/resolve-org-slug';

function EmbedEventContent() {
  const search = useSearchParams();
  const org = resolveOrgSlug(search);
  const serviceId = search.get('serviceId') ?? '';
  const providerId = search.get('providerId') ?? '';

  if (!serviceId || !providerId) {
    return (
      <Card>
        <CardBody className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Invalid embed link (missing service or provider).
          <Link href="/book" className="mt-4 block">
            <Button variant="outline" size="sm">
              Full booking
            </Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <FilledBooking
      params={{
        org: org || undefined,
        serviceId,
        providerId,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        product: search.get('product') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        embed: true,
      }}
    />
  );
}

export default function EmbedBookEventPage() {
  return (
    <div className="min-h-screen bg-white p-4 dark:bg-slate-950 sm:p-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        }
      >
        <EmbedEventContent />
      </Suspense>
    </div>
  );
}
