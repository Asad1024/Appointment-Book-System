'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import {
  CalendarClock,
  CheckCircle2,
  Mail,
  Phone,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiAuth } from '@/lib/api';
import { useStaffSession } from '@/lib/useStaffSession';
import { AdminBookAppointmentHeadingButton } from '@/components/appointments/AdminBookAppointmentHeadingButton';
import { AppointmentNotes, type AppointmentNoteItem } from '@/components/appointments/AppointmentNotes';
import { formatIntakeDisplayValue } from '@/lib/format-intake-value';
import { PageTransition } from '@/components/motion/PageTransition';
import { SlideOver } from '@/components/admin/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Skeleton } from '@/components/ui/skeleton';

type Event = {
  id: string;
  action: string;
  createdAt: string;
  payload?: string | null;
  actorEmail?: string | null;
};

type Appointment = {
  id: string;
  startUtc: string;
  endUtc: string;
  status: string;
  source: string;
  product?: string | null;
  campaign?: string | null;
  manageToken: string;
  rescheduleCount: number;
  locationId: string;
  serviceId: string;
  providerId: string;
  customer: { name: string; email: string; phone?: string | null };
  service: { name: string };
  provider: { name: string };
  location: { name: string; timezone: string };
  events: Event[];
  intakeResponses?: { fieldLabel: string; fieldType: string; value: string }[];
  notes?: AppointmentNoteItem[];
};

type Slot = { startUtc: string; endUtc: string };

export default function AdminAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useStaffSession({ redirectToLogin: false });
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
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
    setStatusLoading(status);
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
      setStatusLoading(null);
      setConfirmCancel(false);
    }
  }

  async function reschedule() {
    if (!appt || !newStartUtc) return;
    setRescheduleLoading(true);
    try {
      await api(`/appointments/manage/${appt.manageToken}/reschedule`, {
        method: 'POST',
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
        <Link href="/admin/dashboard" className="mt-4 inline-block text-brand-600 hover:underline">
          Back to dashboard
        </Link>
      </PageTransition>
    );
  }

  const canModify = !['cancelled', 'completed'].includes(appt.status);
  const reschedulesLeft = Math.max(0, 3 - appt.rescheduleCount);
  const canCheckIn = appt.status === 'confirmed';
  const canMarkComplete = appt.status === 'checked_in';
  const canNoShow = ['confirmed', 'checked_in'].includes(appt.status);
  const canCancel = ['pending', 'confirmed', 'checked_in'].includes(appt.status);

  return (
    <PageTransition>
      <div className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        <div className="mb-4 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                Appointment
              </h1>
              <p className="mt-1 text-sm text-text-secondary">{appt.service.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminBookAppointmentHeadingButton />
              <StatusBadge status={appt.status} className="text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 sm:px-5 lg:px-6">
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
                  <dd className="text-xs text-text-secondary">
                    UTC: {formatInTimeZone(new Date(appt.startUtc), 'UTC', 'PPpp')}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Staff</dt>
                  <dd className="mt-0.5 font-medium">{appt.provider.name}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Location</dt>
                  <dd className="mt-0.5 font-medium">{appt.location.name}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Shared from</dt>
                  <dd className="mt-0.5 font-medium capitalize">{appt.source}</dd>
                </div>
                {appt.product && (
                  <div>
                    <dt className="text-text-muted">Product</dt>
                    <dd className="mt-0.5 font-medium">{appt.product}</dd>
                  </div>
                )}
                {appt.campaign && (
                  <div>
                    <dt className="text-text-muted">Link name</dt>
                    <dd className="mt-0.5 font-medium">{appt.campaign}</dd>
                  </div>
                )}
              </dl>

              {canModify && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-6 dark:border-slate-800">
                  <Button
                    size="sm"
                    loading={statusLoading === 'checked_in'}
                    disabled={!canCheckIn || statusLoading !== null}
                    onClick={() => setStatus('checked_in')}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Check in
                  </Button>
                  <Button
                    size="sm"
                    loading={statusLoading === 'completed'}
                    disabled={!canMarkComplete || statusLoading !== null}
                    onClick={() => setStatus('completed')}
                  >
                    Mark complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={statusLoading === 'no_show'}
                    disabled={!canNoShow || statusLoading !== null}
                    onClick={() => setStatus('no_show')}
                  >
                    No-show
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
                    <CalendarClock className="mr-1 h-4 w-4" />
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!canCancel || statusLoading !== null}
                    onClick={() => setConfirmCancel(true)}
                  >
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
                  <p className="text-sm text-text-secondary">Booked customer</p>
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
                    <dd className="text-sm font-semibold text-text-primary">
                      {formatIntakeDisplayValue(r.fieldType, r.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}

        <Card className="mt-6">
          <CardBody>
            <h2 className="mb-4 font-display text-lg font-semibold">Activity</h2>
            {appt.events?.length === 0 ? (
              <p className="text-sm text-text-secondary">No activity yet.</p>
            ) : (
              <ol className="relative space-y-0 border-l border-slate-200 pl-6 dark:border-slate-700">
                {appt.events.map((ev) => (
                  <li key={ev.id} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[1.35rem] top-1 flex h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
                    <p className="text-sm font-medium capitalize">{ev.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(ev.createdAt).toLocaleString()}
                      {ev.actorEmail && ` - ${ev.actorEmail}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

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
          description={reschedulesLeft > 0 ? `${reschedulesLeft} reschedule(s) remaining` : 'Maximum reschedules reached'}
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
              disabled={!newStartUtc || reschedulesLeft === 0}
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
          description="The customer will be notified. This cannot be undone."
          confirmLabel="Cancel appointment"
          variant="destructive"
          loading={statusLoading === 'cancelled'}
          onConfirm={() => setStatus('cancelled')}
        />
      </div>
    </PageTransition>
  );
}

