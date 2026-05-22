'use client';

import type { ReactNode } from 'react';

/**
 * Matches admin list pages (Services, Team, Providers): full-bleed header band + content padding.
 */
export function StaffPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
      <StaffPageHeader title={title} description={description} actions={actions} />
      <div className="px-4 pb-6 sm:px-5 lg:px-6">{children}</div>
    </div>
  );
}

/**
 * Matches admin dashboard: header band only (main area already has p-0).
 */
/** Dashboard layout: full-width header band, then padded content (main has p-0). */
export function StaffPageShellFlush({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <StaffPageHeader title={title} description={description} actions={actions} />
      <div className="px-4 pb-6 sm:px-5 lg:px-6">{children}</div>
    </>
  );
}

export function StaffPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
