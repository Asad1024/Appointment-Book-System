'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function PartnerBookingFooter({ returnUrl }: { returnUrl?: string | null }) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span>Powered by Slotwise</span>
      {returnUrl ? (
        <Link
          href={returnUrl}
          className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Return to workspace
        </Link>
      ) : null}
    </footer>
  );
}
