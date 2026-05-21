'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronsUpDown, MapPin } from 'lucide-react';
import { useAdminLocation } from '@/lib/admin-location-context';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LocationSwitcherProps = {
  className?: string;
  variant?: 'header' | 'sidebar';
};

function locationSubtitle(loc: { timezone: string; address?: string | null }) {
  if (loc.address?.trim()) return loc.address.trim();
  return loc.timezone.replace(/_/g, ' ');
}

export function LocationSwitcher({ className, variant = 'header' }: LocationSwitcherProps) {
  const { locations, locationId, setLocationId, loading } = useAdminLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = locations.find((l) => l.id === locationId) ?? locations[0] ?? null;
  const canSwitch = locations.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) {
    return (
      <div className={cn('w-full', className)}>
        <Skeleton className={cn('w-full', variant === 'sidebar' ? 'h-10 rounded-lg' : 'h-10 rounded-lg')} />
      </div>
    );
  }

  if (!current) return null;

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        id="admin-location"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={!canSwitch}
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-left transition',
          'hover:border-slate-300 hover:bg-slate-50/80',
          'dark:border-slate-700/90 dark:bg-slate-900/90 dark:hover:border-slate-600 dark:hover:bg-slate-900',
          canSwitch && open && 'border-slate-300 ring-2 ring-brand-500/15 dark:border-slate-600',
          !canSwitch && 'cursor-default',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
          <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {current.name}
        </span>
        {canSwitch ? (
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        ) : null}
      </button>

      {open && canSwitch ? (
        <div
          role="listbox"
          aria-labelledby="admin-location"
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg',
            'dark:border-slate-700/90 dark:bg-slate-950 dark:shadow-black/40',
          )}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {locations.map((loc) => {
              const selected = loc.id === current.id;
              return (
                <li key={loc.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setLocationId(loc.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-3 text-left transition',
                      selected
                        ? 'bg-slate-50 dark:bg-slate-900/80'
                        : 'hover:bg-slate-50/90 dark:hover:bg-slate-900/60',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                      <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {loc.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {locationSubtitle(loc)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
