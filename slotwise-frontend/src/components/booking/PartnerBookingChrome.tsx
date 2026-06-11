'use client';

import { Logo } from '@/components/Logo';

/** Platform logo on the left; organization on the right. */
export function PartnerBookingChrome({ orgName }: { orgName?: string }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <Logo href={undefined} className="pointer-events-none shrink-0" markSize={28} />
      {orgName ? (
        <div className="min-w-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Organization
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{orgName}</p>
        </div>
      ) : null}
    </header>
  );
}
