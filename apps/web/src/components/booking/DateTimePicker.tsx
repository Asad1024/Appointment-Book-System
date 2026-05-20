'use client';

import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import clsx from 'clsx';
import 'react-day-picker/style.css';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
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

function dayPickerClassNames(size: 'default' | 'compact' | 'split' = 'default') {
  const dayCell =
    size === 'compact'
      ? 'h-9 w-9 text-sm'
      : size === 'split'
        ? 'mx-auto h-12 w-full max-w-[3rem] text-[15px]'
        : 'h-10 w-10 text-sm';

  return {
    root: cn(
      'rdp-root booking-day-picker text-slate-900 dark:text-slate-100',
      size === 'split' && 'booking-day-picker--split',
    ),
    month_caption: 'rdp-month_caption pr-16',
    nav: 'rdp-nav top-1.5 right-0',
    caption_label: cn(
      'rdp-caption_label font-semibold text-slate-900 dark:text-slate-100',
      size === 'split' ? 'text-base' : 'text-sm',
    ),
    button_previous:
      'rdp-button_previous h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
    button_next:
      'rdp-button_next h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
    weekday: cn(
      'rdp-weekday font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
      size === 'split' ? 'text-xs' : 'text-[11px]',
    ),
    day_button: cn(
      'rdp-day_button rounded-full border border-transparent font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-50',
      dayCell,
    ),
    day: 'rdp-day p-0',
    selected: 'rdp-selected',
    outside: 'rdp-outside text-slate-300 dark:text-slate-600',
    disabled: 'rdp-disabled text-slate-300 dark:text-slate-600',
    today: 'rdp-today font-semibold text-brand-600 dark:text-brand-400',
    chevron: 'rdp-chevron fill-brand-600 dark:fill-brand-400',
  };
}

function SlotList({
  slots,
  loading,
  startUtc,
  onSlotSelect,
  customerTimezone,
  accentColor,
  use24Hour,
  currentStartUtc,
  layout,
}: {
  slots: Slot[];
  loading: boolean;
  startUtc: string;
  onSlotSelect: (utc: string) => void;
  customerTimezone: string;
  accentColor: string;
  use24Hour: boolean;
  currentStartUtc?: string;
  layout: 'stacked' | 'split';
}) {
  const timeFmt = use24Hour ? 'HH:mm' : 'h:mm a';

  if (layout === 'split') {
    return (
      <ul className="max-h-[min(420px,60vh)] space-y-1.5 overflow-y-auto pr-0.5" aria-live="polite">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={`sk-${i}`}>
              <Skeleton className="h-11 w-full rounded-md" />
            </li>
          ))}
        {!loading &&
          slots.map((slot) => {
            const isSelected = startUtc === slot.startUtc;
            const isCurrent = currentStartUtc != null && currentStartUtc === slot.startUtc;
            return (
              <li key={slot.startUtc}>
                <button
                  type="button"
                  onClick={() => onSlotSelect(slot.startUtc)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition',
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                  )}
                  style={isSelected ? { borderColor: accentColor, backgroundColor: accentColor } : undefined}
                >
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      isSelected ? 'bg-white/90' : 'bg-emerald-500',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">
                    {formatInTimeZone(new Date(slot.startUtc), customerTimezone, timeFmt)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold uppercase opacity-80">Current</span>
                  )}
                </button>
              </li>
            );
          })}
      </ul>
    );
  }

  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-live="polite">
      {loading &&
        Array.from({ length: 8 }).map((_, i) => (
          <li key={`sk-${i}`}>
            <Skeleton className="h-10 w-full rounded-xl" />
          </li>
        ))}
      {!loading &&
        slots.map((slot) => {
          const isSelected = startUtc === slot.startUtc;
          const isCurrent = currentStartUtc != null && currentStartUtc === slot.startUtc;
          return (
            <li key={slot.startUtc}>
              <button
                type="button"
                onClick={() => onSlotSelect(slot.startUtc)}
                className={clsx(
                  'flex w-full flex-col items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                  isSelected
                    ? 'border-2 bg-brand-50/80 text-brand-700 dark:bg-brand-950/35 dark:text-brand-300'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/30',
                )}
                style={isSelected ? { borderColor: accentColor } : undefined}
              >
                <span>{formatInTimeZone(new Date(slot.startUtc), customerTimezone, timeFmt)}</span>
                {isCurrent && (
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    Current
                  </span>
                )}
              </button>
            </li>
          );
        })}
    </ul>
  );
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
  currentStartUtc,
  layout = 'stacked',
  hideTimezone = false,
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
  /** When rescheduling, marks the customer's existing slot in the grid. */
  currentStartUtc?: string;
  layout?: 'stacked' | 'split';
  /** Partner split layout shows timezone in the left column. */
  hideTimezone?: boolean;
}) {
  const [use24Hour, setUse24Hour] = useState(false);
  const timezones = useMemo(() => timezoneOptionsFor(customerTimezone), [customerTimezone]);

  const selectedDay = selectedDate ? parseISO(selectedDate) : undefined;
  const minDay = parseISO(minDate);
  const maxDay = parseISO(maxDate);

  const dayPicker = (
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
      classNames={dayPickerClassNames(layout === 'split' ? 'split' : 'default')}
    />
  );

  if (layout === 'split') {
    const dayHeading = selectedDate
      ? formatInTimeZone(parseISO(`${selectedDate}T12:00:00`), customerTimezone, 'EEE d')
      : 'Select a date';

    return (
      <div className="flex min-h-[320px] flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 items-start border-b border-slate-100 px-4 py-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
          <div className="w-full">{dayPicker}</div>
        </div>
        <div className="flex w-full flex-col p-4 lg:w-[280px] lg:shrink-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dayHeading}</p>
            <div className="flex rounded-md border border-slate-200 bg-slate-50/80 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setUse24Hour(false)}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition',
                  !use24Hour
                    ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                )}
                style={!use24Hour ? { backgroundColor: accentColor } : undefined}
              >
                12h
              </button>
              <button
                type="button"
                onClick={() => setUse24Hour(true)}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition',
                  use24Hour
                    ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                )}
                style={use24Hour ? { backgroundColor: accentColor } : undefined}
              >
                24h
              </button>
            </div>
          </div>
          {!selectedDate ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Pick a date to see times.</p>
          ) : !loading && slots.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No times this day.</p>
          ) : (
            <SlotList
              slots={slots}
              loading={loading}
              startUtc={startUtc}
              onSlotSelect={onSlotSelect}
              customerTimezone={customerTimezone}
              accentColor={accentColor}
              use24Hour={use24Hour}
              currentStartUtc={currentStartUtc}
              layout="split"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hideTimezone && (
        <>
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
        </>
      )}

      <div>
        <Label>Choose a date</Label>
        <div className="mt-3 flex justify-center rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          {dayPicker}
        </div>
      </div>

      {selectedDate && (
        <div>
          <Label>Available times</Label>
          {!loading && slots.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
              No slots available on this date. Try another day.
            </p>
          )}
          <SlotList
            slots={slots}
            loading={loading}
            startUtc={startUtc}
            onSlotSelect={onSlotSelect}
            customerTimezone={customerTimezone}
            accentColor={accentColor}
            use24Hour={use24Hour}
            currentStartUtc={currentStartUtc}
            layout="stacked"
          />
        </div>
      )}
    </div>
  );
}

