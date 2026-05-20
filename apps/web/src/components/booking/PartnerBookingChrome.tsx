'use client';

import { Logo } from '@/components/Logo';

export function PartnerBookingChrome({
  orgName,
  logoUrl,
}: {
  orgName?: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="mb-4 flex items-center gap-2.5">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-8 object-contain" />
      ) : (
        <Logo href={undefined} className="pointer-events-none scale-90" />
      )}
      <p className="font-display text-sm font-semibold text-slate-800 dark:text-slate-100">
        {orgName ?? 'Appointment'}
      </p>
    </header>
  );
}
