'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Mail,
  Phone,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiAuth } from '@/lib/api';
import { useProviderSession } from '@/lib/useProviderSession';
import { AppointmentNotes, type AppointmentNoteItem } from '@/components/appointments/AppointmentNotes';
import { formatIntakeDisplayValue } from '@/lib/format-intake-value';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Event = {
  id: string;
  action: string;
  createdAt: string;
  actorEmail?: string | null;
};

type Appointment = {
  id: string;
  startUtc: string;
  status: string;
  rescheduleCount: number;
  locationId: string;
  serviceId: string;
  providerId: string;
  customer: { name: string; email: string; phone?: string | null };
  service: { name: string };
  location: { name: string; timezone: string };
  events: Event[];
  intakeResponses?: { fieldLabel: string; fieldType: string; value: string }[];
  notes?: AppointmentNoteItem[];
};

type Slot = { startUtc: string; endUtc: string };

export default function ProviderAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useProviderSession({ redirectToLogin: false });
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [newStartUtc, setNewStartUtc] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAppt(await apiAuth<Appointment>(`/appointments/admin/${id}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Not found');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (!appt || !selectedDate || !rescheduleOpen) return;
    api<{ slots: Slot[] }>(
      `/availability/slots?locationId=${appt.locationId}&serviceId=${appt.serviceId}&providerId=${appt.providerId}&fromDate=${selectedDate}&toDate=${selectedDate}&excludeAppointmentId=${appt.id}`,
    )
      .then((r) => setSlots(r.slots))
      .catch((e) => toast.error(e.message));
  }, [appt, selectedDate, rescheduleOpen]);

  async function setStatus(status: string) {
    setStatusLoading(true);
    try {
      const updated = await apiAuth<Appointment>(`/appointments/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAppt(updated);
      toast.success(`Marked as ${status.replace(/_/g, ' ')}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setStatusLoading(false);
      setConfirmCancel(false);
    }
  }

  async function reschedule() {
    if (!newStartUtc) return;
    setRescheduleLoading(true);
    try {
      await apiAuth(`/appointments/admin/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ startUtc: newStartUtc }),
      });
      toast.success('Appointment rescheduled');
      setRescheduleOpen(false);
      setNewStartUtc('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reschedule failed');
    } finally {
      setRescheduleLoading(false);
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageTransition>
    );
  }

  if (!appt) {
    return (
      <PageTransition>
        <p className="text-text-secondary">Appointment not found.</p>
        <Link href="/provider/dashboard" className="mt-4 inline-block text-brand-600 hover:underline">
          ← Back
        </Link>
      </PageTransition>
    );
  }

  const canModify = !['cancelled', 'completed'].includes(appt.status);

  return (
    <PageTransition>
      <Link
        href="/provider/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        My appointments
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Appointment</h1>
          <p className="mt-1 text-sm text-text-secondary">{appt.service.name}</p>
        </div>
        <StatusBadge status={appt.status} className="text-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold">Details</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">When</dt>
                <dd className="mt-0.5 font-medium">
                  {formatInTimeZone(new Date(appt.startUtc), appt.location.timezone, 'PPpp')}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Location</dt>
                <dd className="mt-0.5 font-medium">{appt.location.name}</dd>
              </div>
            </dl>

            {canModify && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-6 dark:border-slate-800">
                <Button size="sm" loading={statusLoading} onClick={() => setStatus('checked_in')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Check in
                </Button>
                <Button size="sm" loading={statusLoading} onClick={() => setStatus('completed')}>
                  Mark complete
                </Button>
                <Button size="sm" variant="outline" loading={statusLoading} onClick={() => setStatus('no_show')}>
                  No-show
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
                  <CalendarClock className="mr-1 h-4 w-4" />
                  Reschedule
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="mr-1 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold">Customer</h2>
            <div className="flex items-center gap-3">
              <InitialsAvatar name={appt.customer.name} />
              <div>
                <p className="font-medium">{appt.customer.name}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-text-secondary">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${appt.customer.email}`} className="hover:text-brand-600">
                  {appt.customer.email}
                </a>
              </li>
              {appt.customer.phone && (
                <li className="flex items-center gap-2 text-text-secondary">
                  <Phone className="h-4 w-4 shrink-0" />
                  {appt.customer.phone}
                </li>
              )}
              <li className="flex items-center gap-2 text-text-secondary">
                <User className="h-4 w-4 shrink-0" />
                {appt.service.name}
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      {appt.intakeResponses && appt.intakeResponses.length > 0 && (
        <Card className="mt-6">
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold">Pre-Appointment Information</h2>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              {appt.intakeResponses.map((r, i) => (
                <div key={`${r.fieldLabel}-${i}`} className="grid gap-2 py-3 sm:grid-cols-2">
                  <dt className="text-xs text-text-muted">{r.fieldLabel}</dt>
                  <dd className="text-sm font-semibold">{formatIntakeDisplayValue(r.fieldType, r.value)}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}

      {user && (
        <AppointmentNotes
          appointmentId={appt.id}
          initialNotes={appt.notes ?? []}
          currentUserId={user.id}
          currentUserRole={user.role}
        />
      )}

      <SlideOver
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Reschedule"
        description="Pick a new time for this appointment"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="reschedule-date">Date</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          {selectedDate && (
            <div className="space-y-2">
              <Label>Available slots</Label>
              {slots.length === 0 ? (
                <p className="text-sm text-text-secondary">No slots on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s.startUtc}
                      type="button"
                      size="sm"
                      variant={newStartUtc === s.startUtc ? 'default' : 'outline'}
                      onClick={() => setNewStartUtc(s.startUtc)}
                    >
                      {formatInTimeZone(new Date(s.startUtc), appt.location.timezone, 'h:mm a')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button
            className="w-full"
            disabled={!newStartUtc}
            loading={rescheduleLoading}
            onClick={() => void reschedule()}
          >
            Confirm reschedule
          </Button>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel appointment?"
        description="The customer will be notified."
        confirmLabel="Cancel appointment"
        variant="destructive"
        loading={statusLoading}
        onConfirm={() => setStatus('cancelled')}
      />
    </PageTransition>
  );
}
