'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { BookingWizard } from '@/components/BookingWizard';
import { resolveOrgSlug } from '@/lib/resolve-org-slug';

function EmbedBookContent() {
  const search = useSearchParams();
  const org = resolveOrgSlug(search);
  return (
    <BookingWizard
      params={{
        org: org || undefined,
        product: search.get('product') ?? undefined,
        source: search.get('source') ?? undefined,
        campaign: search.get('campaign') ?? undefined,
        returnUrl: search.get('returnUrl') ?? undefined,
        embed: true,
      }}
    />
  );
}

export default function EmbedBookPage() {
  return (
    <div className="min-h-screen bg-white p-4 dark:bg-slate-950 sm:p-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        }
      >
        <EmbedBookContent />
      </Suspense>
    </div>
  );
}
