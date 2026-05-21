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

import { timezoneOptionsFor } from '@/lib/booking-timezone';

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
  lockToLocationTimezone = false,
}: {
  serviceName: string;
  durationMinutes?: number;
  providerName: string;
  locationName: string;
  locationTimezone: string;
  customerTimezone: string;
  onCustomerTimezoneChange?: (tz: string) => void;
  leadLabel?: string | null;
  selectedTimeLabel?: string;
  accentColor: string;
  /** Partner booking: always show office times; avoid timezone mismatch. */
  lockToLocationTimezone?: boolean;
}) {
  const timezones = timezoneOptionsFor(customerTimezone);

  return (
    <div className="flex h-full flex-col justify-start space-y-8 p-6 lg:p-8">
      {durationMinutes ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-slate-600 dark:text-slate-300"
          style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
        >
          <Clock className="h-4 w-4" aria-hidden />
          {durationMinutes} min
        </span>
      ) : null}

      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold leading-snug text-slate-900 dark:text-slate-100">
          {serviceName}
        </h1>
        <p className="flex items-center gap-2 text-base text-slate-600 dark:text-slate-300">
          <User className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span>{providerName}</span>
        </p>
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <MapPin className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          {locationName}
        </p>
      </div>

      {leadLabel ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{leadLabel}</span>
        </p>
      ) : null}

      <div className="space-y-2.5 pt-1">
        {lockToLocationTimezone ? (
          <>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Office time</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {locationTimezone.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              All times on this page use the office clock (same as the appointment calendar).
            </p>
          </>
        ) : (
          <>
            <Label htmlFor="partner-timezone" className="text-sm text-slate-500 dark:text-slate-400">
              Your timezone
            </Label>
            <Select value={customerTimezone} onValueChange={onCustomerTimezoneChange!}>
              <SelectTrigger id="partner-timezone" className="mt-0.5 h-10 text-sm">
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
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Location: {locationTimezone.replace(/_/g, ' ')}
            </p>
          </>
        )}
      </div>

      {selectedTimeLabel ? (
        <p className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100">
          {selectedTimeLabel}
        </p>
      ) : null}
    </div>
  );
}
