'use client';

import { Clock, MapPin, User } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONE_OPTIONS = [
  'Pacific/Honolulu',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'UTC',
];

function timezoneOptionsFor(value: string) {
  const set = new Set(TIMEZONE_OPTIONS);
  if (value && !set.has(value)) set.add(value);
  return Array.from(set);
}

export function PartnerEventMeta({
  serviceName,
  durationMinutes,
  providerName,
  locationName,
  locationTimezone,
  customerTimezone,
  onCustomerTimezoneChange,
  leadLabel,
  selectedTimeLabel,
  accentColor,
}: {
  serviceName: string;
  durationMinutes?: number;
  providerName: string;
  locationName: string;
  locationTimezone: string;
  customerTimezone: string;
  onCustomerTimezoneChange: (tz: string) => void;
  leadLabel?: string | null;
  selectedTimeLabel?: string;
  accentColor: string;
}) {
  const timezones = timezoneOptionsFor(customerTimezone);

  return (
    <div className="space-y-4 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r dark:border-slate-800">
      {durationMinutes ? (
        <span
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
          style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {durationMinutes} min
        </span>
      ) : null}

      <div>
        <h1 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-slate-100">
          {serviceName}
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <User className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          {providerName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          {locationName}
        </p>
      </div>

      {leadLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{leadLabel}</span>
        </p>
      ) : null}

      <div>
        <Label htmlFor="partner-timezone" className="text-xs text-slate-500">
          Your timezone
        </Label>
        <Select value={customerTimezone} onValueChange={onCustomerTimezoneChange}>
          <SelectTrigger id="partner-timezone" className="mt-1 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          Location: {locationTimezone.replace(/_/g, ' ')}
        </p>
      </div>

      {selectedTimeLabel ? (
        <p className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100">
          {selectedTimeLabel}
        </p>
      ) : null}
    </div>
  );
}
