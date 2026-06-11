'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export type CustomerAppointment = {
  id: string;
  startUtc: string;
  endUtc: string;
  status: string;
  manageToken: string;
  timezone: string;
  customerTimezone?: string | null;
  rescheduleCount: number;
  notes?: string | null;
  service: { name: string; durationMinutes?: number };
  provider: { name: string };
  location: { name: string; address?: string | null; cancellationCutoffH?: number };
};

function durationMinutes(startUtc: string, endUtc: string) {
  return Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60_000);
}

export function CustomerAppointmentCard({
  appointment: a,
  onUpdated,
}: {
  appointment: CustomerAppointment;
  onUpdated: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canModify = a.status !== 'cancelled' && a.status !== 'completed';
  const isUpcoming = new Date(a.startUtc) > new Date() && canModify;
  const reschedulesLeft = Math.max(0, 3 - a.rescheduleCount);
  const mins = a.service.durationMinutes ?? durationMinutes(a.startUtc, a.endUtc);
  const displayTz = a.customerTimezone ?? a.timezone;

  async function cancel() {
    setCancelling(true);
    try {
      await ensureCsrf();
      await api(`/appointments/manage/${a.manageToken}/cancel`, { method: 'POST' });
      toast.success('Appointment cancelled');
      setCancelOpen(false);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Card className="h-full transition-shadow hover:shadow-md dark:border-slate-800">
        <CardBody className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-text-primary">{a.service.name}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{mins} min session</p>
            </div>
            <StatusBadge status={a.status} />
          </div>

          <dl className="mt-4 grid gap-2.5 text-sm">
            <div className="flex gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <div>
                <dt className="sr-only">Staff</dt>
                <dd className="font-medium text-text-primary">{a.provider.name}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <div>
                <dt className="sr-only">Location</dt>
                <dd className="font-medium text-text-primary">{a.location.name}</dd>
                {a.location.address ? (
                  <dd className="text-text-secondary">{a.location.address}</dd>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <div>
                <dt className="sr-only">When</dt>
                <dd className="font-medium text-text-primary">
                  {formatInTimeZone(new Date(a.startUtc), displayTz, 'PPPP')}
                </dd>
                <dd className="text-text-secondary">
                  {formatInTimeZone(new Date(a.startUtc), displayTz, 'p')} ?{' '}
                  {formatInTimeZone(new Date(a.endUtc), displayTz, 'p')}
                  {displayTz !== a.timezone ? (
                    <span className="block text-xs text-text-muted">
                      Location time: {formatInTimeZone(new Date(a.startUtc), a.timezone, 'PPp')}
                    </span>
                  ) : null}
                </dd>
              </div>
            </div>
            {a.notes?.trim() ? (
              <div className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <div>
                  <dt className="text-xs font-medium text-text-muted">Notes</dt>
                  <dd className="text-text-secondary">{a.notes}</dd>
                </div>
              </div>
            ) : null}
          </dl>

          {canModify ? (
            <p className="mt-3 text-xs text-text-secondary">
              {isUpcoming ? 'Upcoming' : 'Past'} � Reschedules left: {reschedulesLeft}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link href={`/manage/${a.manageToken}`} className="flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                Full details
              </Button>
            </Link>
            {canModify && reschedulesLeft > 0 ? (
              <Link href={`/manage/${a.manageToken}?reschedule=1`} className="flex-1 sm:flex-none">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Reschedule
                </Button>
              </Link>
            ) : null}
            {canModify ? (
              <Button
                variant="danger"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={cancelling}
                onClick={() => setCancelOpen(true)}
              >
                Cancel
              </Button>
            ) : null}
            {a.status === 'completed' ? (
              <Link href={`/manage/${a.manageToken}?review=1`} className="flex-1 sm:flex-none">
                <Button size="sm" className="w-full sm:w-auto">
                  Leave a review
                </Button>
              </Link>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this appointment?"
        description="This cannot be undone. You may need to book again for a new time."
        confirmLabel="Yes, cancel"
        variant="destructive"
        loading={cancelling}
        onConfirm={() => void cancel()}
      />
    </>
  );
}
