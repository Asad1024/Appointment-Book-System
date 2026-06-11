'use client';

import Link from 'next/link';
import { Building2, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/motion/PageTransition';
import { PLATFORM } from '@/lib/brand';

type OrganizationNotFoundProps = {
  slug: string;
  /** Shown when the API could not be reached (network), not when org is missing. */
  unavailable?: boolean;
};

export function OrganizationNotFound({ slug, unavailable = false }: OrganizationNotFoundProps) {
  const title = unavailable
    ? 'We could not verify this booking page'
    : 'This organization was not found';
  const description = unavailable
    ? 'Check your connection and try again, or return to the Slotwise home page.'
    : 'This booking link may be incorrect, expired, or the business may have changed its address. Double-check the URL you were given.';

  return (
    <PageTransition>
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-16 text-center sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          <Building2 className="h-8 w-8" aria-hidden />
        </div>
        <p className="mt-6 text-sm font-medium text-brand-600 dark:text-brand-400">{PLATFORM.name}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-text-secondary">{description}</p>
        {!unavailable && slug ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-text-muted dark:border-slate-800 dark:bg-slate-900">
            /{slug}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Go to {PLATFORM.name} home
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline">Start your own workspace</Button>
          </Link>
        </div>
        <p className="mt-8 max-w-sm text-sm text-text-muted">
          Running a business?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Sign in to your workspace
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
