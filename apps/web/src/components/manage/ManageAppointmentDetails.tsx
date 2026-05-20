'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  User,
  Hash,
  FileText,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { SlotOption } from '@/components/shared/DateTimePicker';
import { AppointmentRemindersSection } from '@/components/manage/AppointmentRemindersSection';
import { AppointmentReviewForm } from '@/components/manage/AppointmentReviewForm';
import type { ManageAppointment, ReviewMeta } from '@/app/manage/[token]/types';

const BookingDateTimePicker = dynamic(
  () =>
    import('@/components/booking/DateTimePicker').then((mod) => ({
      default: mod.DateTimePicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-10 w-full max-w-xs" />
        <Skeleton className="mx-auto h-72 w-full max-w-sm rounded-xl" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      </div>
    ),
  },
);

function durationMinutes(startUtc: string, endUtc: string) {
  return Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60_000);
}

type Props = {
  appt: ManageAppointment;
  token: string;
  reviewMeta: ReviewMeta | null;
  error: string;
  loading: boolean;
  rescheduleMode: boolean;
  rescheduleRef: React.RefObject<HTMLDivElement>;
  selectedDate: string;
  slots: SlotOption[];
  newStartUtc: string;
  customerTimezone: string;
  onCustomerTimezoneChange: (tz: string) => void;
  minBookDate: string;
  maxBookDate: string;
  accentColor: string;
  onRescheduleMode: () => void;
  onCloseReschedule: () => void;
  onDateChange: (d: string) => void;
  onSlotSelect: (utc: string) => void;
  onReschedule: () => void;
  onAddToGoogle: () => void;
  onDownloadIcs: () => void;
  onCancelClick: () => void;
  onReviewSubmitted: () => void;
  canChangeTime: boolean;
};

export function ManageAppointmentDetails({
  appt,
  token,
  reviewMeta,
  error,
  loading,
  rescheduleMode,
  rescheduleRef,
  selectedDate,
  slots,
  newStartUtc,
  customerTimezone,
  onCustomerTimezoneChange,
  minBookDate,
  maxBookDate,
  accentColor,
  onRescheduleMode,
  onCloseReschedule,
  onDateChange,
  onSlotSelect,
  onReschedule,
  onAddToGoogle,
  onDownloadIcs,
  onCancelClick,
  onReviewSubmitted,
  canChangeTime,
}: Props) {
  const canModify = appt.status !== 'cancelled' && appt.status !== 'completed';
  const reschedulesLeft = Math.max(0, 3 - appt.rescheduleCount);
  const mins = appt.service.durationMinutes ?? durationMinutes(appt.startUtc, appt.endUtc);
  const displayTz = appt.customerTimezone ?? appt.timezone;
  const shortId = appt.id.slice(0, 8).toUpperCase();

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50/80 to-white px-6 py-5 dark:border-slate-800 dark:from-brand-950/30 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Your appointment
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-text-primary">
              {appt.service.name}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {mins} min · Reference #{shortId}
            </p>
          </div>
          <StatusBadge status={appt.status} />
        </div>
      </div>

      <CardBody className="space-y-6">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {appt.service.description ? (
          <p className="text-sm leading-relaxed text-text-secondary">{appt.service.description}</p>
        ) : null}

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow icon={User} label="Expert" value={appt.provider.name} />
          <DetailRow
            icon={MapPin}
            label="Location"
            value={appt.location.name}
            sub={appt.location.address ?? undefined}
          />
          <DetailRow
            icon={Calendar}
            label="Date"
            value={formatInTimeZone(new Date(appt.startUtc), displayTz, 'PPPP')}
          />
          <DetailRow
            icon={Clock}
            label="Time"
            value={`${formatInTimeZone(new Date(appt.startUtc), displayTz, 'p')} – ${formatInTimeZone(new Date(appt.endUtc), displayTz, 'p')}`}
            sub={
              displayTz !== appt.timezone
                ? `Location: ${formatInTimeZone(new Date(appt.startUtc), appt.timezone, 'PPp')}`
                : `Timezone: ${appt.timezone}`
            }
          />
          <DetailRow icon={Mail} label="Booked by" value={appt.customer.name} sub={appt.customer.email} />
          <DetailRow icon={Hash} label="Duration" value={`${mins} minutes`} />
        </dl>

        {appt.notes?.trim() ? (
          <div className="flex gap-3 rounded-xl border border-slate-100 bg-surface-muted px-4 py-3 dark:border-slate-800">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Your notes</p>
              <p className="mt-1 text-sm text-text-primary">{appt.notes}</p>
            </div>
          </div>
        ) : null}

        <AppointmentRemindersSection
          reminders={appt.reminders ?? []}
          displayTimezone={displayTz}
          appointmentStatus={appt.status}
        />

        {canModify && (
          <p className="text-sm text-text-secondary">
            Reschedules remaining:{' '}
            <span className="font-semibold text-text-primary">{reschedulesLeft}</span>
            {appt.location.cancellationCutoffH > 0 && canChangeTime && (
              <span className="text-text-muted">
                {' '}
                · Cancel or reschedule at least {appt.location.cancellationCutoffH}h before start when
                booked in advance
              </span>
            )}
          </p>
        )}

        {canModify && !canChangeTime && (
          <Alert variant="info">
            Changes are no longer allowed online — you are within{' '}
            {appt.location.cancellationCutoffH > 0
              ? `the ${appt.location.cancellationCutoffH}-hour change window`
              : 'the final hour before your appointment'}
            . Contact {appt.location.name} if you need help.
          </Alert>
        )}

        {rescheduleMode && canChangeTime && (
          <div
            ref={rescheduleRef}
            className="scroll-mt-24 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-5 dark:border-brand-800 dark:bg-brand-950/20"
          >
            <h3 className="font-semibold text-text-primary">Pick a new time</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Your current appointment is pre-selected. Choose another date or time with{' '}
              {appt.provider.name}, or confirm to keep the same slot.
            </p>
            <p className="mt-2 rounded-lg border border-brand-200/80 bg-white/80 px-3 py-2 text-sm text-text-primary dark:border-brand-800 dark:bg-slate-900/80">
              <span className="font-medium">Current time: </span>
              {formatInTimeZone(new Date(appt.startUtc), customerTimezone, 'EEE, MMM d · h:mm a')}
            </p>
            <div className="mt-4">
              <BookingDateTimePicker
                locationTimezone={appt.timezone}
                customerTimezone={customerTimezone}
                onCustomerTimezoneChange={onCustomerTimezoneChange}
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                startUtc={newStartUtc}
                onSlotSelect={onSlotSelect}
                slots={slots}
                loading={loading}
                minDate={minBookDate}
                maxDate={maxBookDate}
                accentColor={accentColor}
                currentStartUtc={appt.startUtc}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={!newStartUtc || loading} onClick={onReschedule}>
                Confirm new time
              </Button>
              <Button variant="outline" onClick={onCloseReschedule}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {appt.status === 'completed' && reviewMeta && token && (
          <AppointmentReviewForm
            manageToken={token}
            customerName={appt.customer.name}
            initial={{ canReview: reviewMeta.canReview, review: reviewMeta.review ?? null }}
            onSubmitted={onReviewSubmitted}
          />
        )}

        {canModify && !rescheduleMode && (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Button variant="outline" onClick={onAddToGoogle}>
              Add to Google Calendar
            </Button>
            <Button variant="outline" onClick={onDownloadIcs}>
              Download .ics
            </Button>
            {canChangeTime && reschedulesLeft > 0 && (
              <Button variant="outline" onClick={onRescheduleMode}>
                Reschedule
              </Button>
            )}
            {canChangeTime && (
              <Button variant="danger" disabled={loading} onClick={onCancelClick}>
                Cancel appointment
              </Button>
            )}
          </div>
        )}

        {appt.status === 'cancelled' && (
          <div className="rounded-xl border border-slate-200 bg-surface-muted px-4 py-3 text-sm text-text-secondary dark:border-slate-700">
            This appointment was cancelled.{' '}
            <Link href="/book" className="font-medium text-brand-600 hover:underline">
              Book a new session
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-text-primary">{value}</dd>
        {sub ? <dd className="mt-0.5 text-xs text-text-secondary">{sub}</dd> : null}
      </div>
    </div>
  );
}
