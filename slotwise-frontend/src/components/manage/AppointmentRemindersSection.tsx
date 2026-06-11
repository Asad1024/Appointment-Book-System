'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { Bell, CheckCircle2, Clock } from 'lucide-react';
import type { ReminderScheduleItem } from '@pkg/shared-types';
import { cn } from '@/lib/utils';

function statusLabel(status: ReminderScheduleItem['status']) {
  if (status === 'sent') return 'Sent';
  if (status === 'upcoming') return 'Scheduled';
  return 'Not sent';
}

function statusClass(status: ReminderScheduleItem['status']) {
  if (status === 'sent') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (status === 'upcoming') {
    return 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400';
}

type Props = {
  reminders: ReminderScheduleItem[];
  displayTimezone: string;
  appointmentStatus: string;
};

export function AppointmentRemindersSection({
  reminders,
  displayTimezone,
  appointmentStatus,
}: Props) {
  const isTerminal =
    appointmentStatus === 'cancelled' || appointmentStatus === 'completed';

  return (
    <div className="rounded-xl border border-slate-100 bg-surface-muted/60 px-4 py-4 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Reminders
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Confirmation was sent when you booked (email and WhatsApp if a phone number was
            provided).
            {reminders.length > 0
              ? ' These automatic reminders are also scheduled:'
              : ' No extra reminders were selected for this booking.'}
          </p>

          {reminders.length > 0 && (
            <ul className="mt-4 space-y-2">
              {reminders.map((item) => (
                <li
                  key={item.minutesBefore}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.status === 'sent' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-text-muted" />
                    )}
                    <div>
                      <p className="font-medium text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-muted">
                        {isTerminal && item.status === 'upcoming'
                          ? 'No longer applicable'
                          : formatInTimeZone(
                              new Date(item.fireAtUtc),
                              displayTimezone,
                              'EEE, MMM d · h:mm a',
                            )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      statusClass(
                        isTerminal && item.status === 'upcoming' ? 'missed' : item.status,
                      ),
                    )}
                  >
                    {statusLabel(
                      isTerminal && item.status === 'upcoming' ? 'missed' : item.status,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
