'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { formatTimezoneLabel } from '@/lib/booking-dates';
import { cn } from '@/lib/cn';

function formatAppointmentLine(
  startUtc: string,
  endUtc: string | undefined,
  timezone: string,
): string {
  const start = new Date(startUtc);
  const date = formatInTimeZone(start, timezone, 'EEEE, MMMM d, yyyy');
  const startTime = formatInTimeZone(start, timezone, 'h:mm a');
  if (endUtc) {
    const endTime = formatInTimeZone(new Date(endUtc), timezone, 'h:mm a');
    return `${date} · ${startTime} – ${endTime}`;
  }
  return `${date} · ${startTime}`;
}

type Props = {
  startUtc: string;
  endUtc?: string;
  customerTimezone: string;
  officeTimezone: string;
  /** Tighter layout for partner sidebar */
  compact?: boolean;
  className?: string;
};

export function AppointmentTimeSummary({
  startUtc,
  endUtc,
  customerTimezone,
  officeTimezone,
  compact = false,
  className,
}: Props) {
  const sameZone = customerTimezone === officeTimezone;
  const yourLine = formatAppointmentLine(startUtc, endUtc, customerTimezone);
  const officeLine = sameZone
    ? null
    : formatAppointmentLine(startUtc, endUtc, officeTimezone);

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50',
        compact ? 'space-y-2.5 p-3 text-sm' : 'space-y-3 p-4 text-sm',
        className,
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Your time
        </p>
        <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{yourLine}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {formatTimezoneLabel(customerTimezone)}
        </p>
      </div>
      {officeLine ? (
        <div className={compact ? 'border-t border-slate-200 pt-2.5 dark:border-slate-700' : 'border-t border-slate-200 pt-3 dark:border-slate-700'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Office time
          </p>
          <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{officeLine}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatTimezoneLabel(officeTimezone)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
