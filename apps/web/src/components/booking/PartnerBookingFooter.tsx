'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PartnerBookingFooter({
  returnUrl,
  className,
}: {
  returnUrl?: string | null;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        'flex w-full flex-col items-center gap-2 pt-4 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:justify-between',
        className,
      )}
    >
      <span>
        Powered by <span className="font-medium text-slate-600 dark:text-slate-300">Slotwise</span>
      </span>
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
