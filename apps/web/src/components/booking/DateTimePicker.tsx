'use client';

import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import clsx from 'clsx';
import 'react-day-picker/style.css';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Slot = { startUtc: string; endUtc: string };

const TIMEZONE_OPTIONS = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

function timezoneOptionsFor(value: string) {
  const set = new Set(TIMEZONE_OPTIONS);
  if (value && !set.has(value)) set.add(value);
  return Array.from(set);
}

export function DateTimePicker({
  locationTimezone,
  customerTimezone,
  onCustomerTimezoneChange,
  selectedDate,
  onDateChange,
  startUtc,
  onSlotSelect,
  slots,
  loading,
  minDate,
  maxDate,
  accentColor,
}: {
  locationTimezone: string;
  customerTimezone: string;
  onCustomerTimezoneChange: (tz: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  startUtc: string;
  onSlotSelect: (utc: string) => void;
  slots: Slot[];
  loading: boolean;
  minDate: string;
  maxDate: string;
  accentColor: string;
}) {
  const timezones = useMemo(() => timezoneOptionsFor(customerTimezone), [customerTimezone]);

  const selectedDay = selectedDate ? parseISO(selectedDate) : undefined;
  const minDay = parseISO(minDate);
  const maxDay = parseISO(maxDate);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-300">
        Location time ({locationTimezone}) - Your time ({customerTimezone})
      </p>

      <div>
        <Label htmlFor="customer-timezone">Your timezone</Label>
        <Select value={customerTimezone} onValueChange={onCustomerTimezoneChange}>
          <SelectTrigger id="customer-timezone" className="mt-1.5">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Choose a date</Label>
        <div className="mt-3 flex justify-center rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={(day) => {
              if (day) onDateChange(format(day, 'yyyy-MM-dd'));
            }}
            disabled={[{ before: minDay }, { after: maxDay }]}
            defaultMonth={selectedDay ?? minDay}
            navLayout="after"
            style={{ ['--booking-accent' as string]: accentColor } as React.CSSProperties}
            classNames={{
              root: 'rdp-root booking-day-picker text-slate-900 dark:text-slate-100',
              month_caption: 'rdp-month_caption pr-16',
              nav: 'rdp-nav top-1.5 right-0',
              caption_label: 'rdp-caption_label text-sm font-semibold text-slate-900 dark:text-slate-100',
              button_previous:
                'rdp-button_previous h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              button_next:
                'rdp-button_next h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              weekday: 'rdp-weekday text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
              day_button:
                'rdp-day_button h-10 w-10 rounded-full border border-transparent text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50',
              day: 'rdp-day p-0',
              selected: 'rdp-selected',
              outside: 'rdp-outside text-slate-300 dark:text-slate-600',
              disabled: 'rdp-disabled text-slate-300 dark:text-slate-600',
              today: 'rdp-today font-semibold text-brand-600 dark:text-brand-400',
              chevron: 'rdp-chevron fill-brand-600 dark:fill-brand-400',
            }}
          />
        </div>
      </div>

      {selectedDate && (
        <div>
          <Label>Available times</Label>
          {!loading && slots.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">No slots available on this date. Try another day.</p>
          )}
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-live="polite">
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <li key={`sk-${i}`}>
                  <Skeleton className="h-10 w-full rounded-xl" />
                </li>
              ))}
            {!loading &&
              slots.map((slot) => (
                <li key={slot.startUtc}>
                  <button
                    type="button"
                    onClick={() => onSlotSelect(slot.startUtc)}
                    className={clsx(
                      'w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                      startUtc === slot.startUtc
                        ? 'border-2 bg-brand-50/80 text-brand-700 dark:bg-brand-950/35 dark:text-brand-300'
                        : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/30',
                    )}
                    style={
                      startUtc === slot.startUtc
                        ? { borderColor: accentColor }
                        : undefined
                    }
                  >
                    {formatInTimeZone(new Date(slot.startUtc), customerTimezone, 'h:mm a')}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

