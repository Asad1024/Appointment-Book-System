'use client';

import Link from 'next/link';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DateTimePicker, type SlotOption } from '@/components/shared/DateTimePicker';
import { AppointmentReviewForm } from '@/components/manage/AppointmentReviewForm';
import type { ManageAppointment, ReviewMeta } from '@/app/manage/[token]/types';

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
  onRescheduleMode: (open: boolean) => void;
  onDateChange: (d: string) => void;
  onSlotSelect: (utc: string) => void;
  onReschedule: () => void;
  onAddToGoogle: () => void;
  onDownloadIcs: () => void;
  onCancelClick: () => void;
  onReviewSubmitted: () => void;
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
  onRescheduleMode,
  onDateChange,
  onSlotSelect,
  onReschedule,
  onAddToGoogle,
  onDownloadIcs,
  onCancelClick,
  onReviewSubmitted,
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

        {canModify && (
          <p className="text-sm text-text-secondary">
            Reschedules remaining:{' '}
            <span className="font-semibold text-text-primary">{reschedulesLeft}</span>
            {appt.location.cancellationCutoffH > 0 && (
              <span className="text-text-muted">
                {' '}
                · Cancel or reschedule at least {appt.location.cancellationCutoffH}h before start
              </span>
            )}
          </p>
        )}

        {rescheduleMode && canModify && (
          <div
            ref={rescheduleRef}
            className="scroll-mt-24 rounded-xl border-2 border-brand-200 bg-brand-50/40 p-5 dark:border-brand-800 dark:bg-brand-950/20"
          >
            <h3 className="font-semibold text-text-primary">Pick a new time</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Choose a date and available slot with {appt.provider.name}.
            </p>
            <div className="mt-4">
              <DateTimePicker
                timezone={appt.timezone}
                selectedDate={selectedDate}
                onDateChange={(d) => {
                  onDateChange(d);
                  onSlotSelect('');
                }}
                selectedStartUtc={newStartUtc}
                onSlotSelect={onSlotSelect}
                slots={slots}
                loading={loading}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={!newStartUtc || loading} onClick={onReschedule}>
                Confirm new time
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onRescheduleMode(false);
                  onDateChange('');
                  onSlotSelect('');
                }}
              >
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
            {reschedulesLeft > 0 && (
              <Button variant="outline" onClick={() => onRescheduleMode(true)}>
                Reschedule
              </Button>
            )}
            <Button variant="danger" disabled={loading} onClick={onCancelClick}>
              Cancel appointment
            </Button>
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
