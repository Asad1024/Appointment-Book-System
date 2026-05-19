'use client';

import { MapPin } from 'lucide-react';
import { useAdminLocation } from '@/lib/admin-location-context';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type LocationSwitcherProps = {
  className?: string;
  variant?: 'header' | 'sidebar';
};

export function LocationSwitcher({ className, variant = 'header' }: LocationSwitcherProps) {
  const { locations, locationId, setLocationId, loading } = useAdminLocation();

  if (loading || locations.length <= 1) return null;

  const isSidebar = variant === 'sidebar';
  const currentValue = locationId || locations[0]?.id;

  return (
    <div className={cn('w-full', className)}>
      {isSidebar && (
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Location
        </p>
      )}
      <Label htmlFor="admin-location" className="sr-only">
        Location
      </Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Select value={currentValue} onValueChange={setLocationId}>
          <SelectTrigger
            id="admin-location"
            className={cn(
              'pl-9',
              isSidebar
                ? 'min-h-11 border border-transparent bg-white/95 text-slate-900 shadow-sm shadow-slate-200/80 focus:border-brand-500/50 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-black/20 dark:focus:border-brand-400/60'
                : 'min-w-[200px]',
            )}
          >
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent
            align="start"
            className="rounded-xl border-slate-200 shadow-xl dark:border-slate-700"
          >
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

