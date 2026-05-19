'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ManageAppointmentDetails } from '@/components/manage/ManageAppointmentDetails';
import { ManageAppointmentSidebar } from '@/components/manage/ManageAppointmentSidebar';
import { downloadIcsFile, openGoogleCalendar } from '@/lib/calendar-export';
import type { ManageAppointment, ReviewMeta } from './types';
import type { SlotOption } from '@/components/shared/DateTimePicker';
import { pageContainer } from '@/lib/layout';
import { cn } from '@/lib/utils';

function calendarEventFromAppt(appt: ManageAppointment) {
  return {
    title: appt.service.name,
    startUtc: appt.startUtc,
    endUtc: appt.endUtc,
    timezone: appt.customerTimezone ?? appt.timezone,
    description: `With ${appt.provider.name}`,
    location: [appt.location.name, appt.location.address].filter(Boolean).join(' — '),
  };
}

function ManagePageContent() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [appt, setAppt] = useState<ManageAppointment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [newStartUtc, setNewStartUtc] = useState('');
  const [reviewMeta, setReviewMeta] = useState<ReviewMeta | null>(null);
  const rescheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    setPageLoading(true);
    Promise.all([
      api<ManageAppointment>(`/appointments/manage/${token}`),
      api<ReviewMeta>(`/reviews/manage/${token}`),
    ])
      .then(([appointment, reviews]) => {
        setAppt(appointment);
        setReviewMeta(reviews);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load appointment'))
      .finally(() => setPageLoading(false));
  }, [token]);

  useEffect(() => {
    if (!appt || pageLoading) return;
    if (searchParams.get('reschedule') === '1' && appt.status !== 'cancelled' && appt.status !== 'completed') {
      setRescheduleMode(true);
    }
    if (searchParams.get('review') === '1' && appt.status === 'completed') {
      setTimeout(() => {
        document.getElementById('review-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [appt, pageLoading, searchParams]);

  useEffect(() => {
    if (rescheduleMode && rescheduleRef.current) {
      rescheduleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [rescheduleMode]);

  useEffect(() => {
    if (!appt || !selectedDate || !rescheduleMode) return;
    setLoading(true);
    api<{ slots: SlotOption[] }>(
      `/availability/slots?locationId=${appt.locationId}&serviceId=${appt.serviceId}&providerId=${appt.providerId}&fromDate=${selectedDate}&toDate=${selectedDate}&excludeAppointmentId=${appt.id}`,
    )
      .then((r) => setSlots(r.slots))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load slots'))
      .finally(() => setLoading(false));
  }, [appt, selectedDate, rescheduleMode]);

  async function cancel() {
    setLoading(true);
    setError('');
    try {
      const updated = await api<ManageAppointment>(`/appointments/manage/${token}/cancel`, {
        method: 'POST',
      });
      setAppt(updated);
      setRescheduleMode(false);
      setCancelOpen(false);
      toast.success('Appointment cancelled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setLoading(false);
    }
  }

  async function reschedule() {
    if (!newStartUtc) return;
    setLoading(true);
    setError('');
    try {
      const updated = await api<ManageAppointment>(`/appointments/manage/${token}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ startUtc: newStartUtc }),
      });
      setAppt(updated);
      setRescheduleMode(false);
      setNewStartUtc('');
      setSelectedDate('');
      toast.success('Appointment rescheduled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reschedule');
    } finally {
      setLoading(false);
    }
  }

  function addToGoogleCalendar() {
    if (!appt) return;
    openGoogleCalendar(calendarEventFromAppt(appt));
  }

  function downloadIcs() {
    if (!appt) return;
    downloadIcsFile(calendarEventFromAppt(appt));
  }

  const canModify = appt ? appt.status !== 'cancelled' && appt.status !== 'completed' : false;
  const reschedulesLeft = appt ? Math.max(0, 3 - appt.rescheduleCount) : 0;

  return (
    <div className="bg-surface-subtle pb-16">
      <div className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className={cn(pageContainer, 'py-6')}>
          <nav className="flex flex-wrap items-center gap-1 text-sm text-text-muted" aria-label="Breadcrumb">
            <Link href="/" className="inline-flex items-center gap-1 hover:text-brand-600">
              <Home className="h-4 w-4" />
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-text-secondary">Manage appointment</span>
          </nav>
          <h1 className="mt-3 font-display text-2xl font-bold text-text-primary sm:text-3xl">
            Manage your appointment
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary sm:text-base">
            View details, reschedule, cancel, or add this session to your calendar. No sign-in required —
            this link is private to you.
          </p>
        </div>
      </div>

      <div className={cn(pageContainer, 'py-8')}>
        {pageLoading && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {error && !appt && !pageLoading && (
          <Card className="max-w-lg">
            <CardBody>
              <Alert variant="error">{error}</Alert>
              <Link href="/book" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
                Book a new appointment
              </Link>
            </CardBody>
          </Card>
        )}

        {appt && !pageLoading && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ManageAppointmentDetails
                appt={appt}
                token={token ?? ''}
                reviewMeta={reviewMeta}
                error={error}
                loading={loading}
                rescheduleMode={rescheduleMode}
                rescheduleRef={rescheduleRef}
                selectedDate={selectedDate}
                slots={slots}
                newStartUtc={newStartUtc}
                onRescheduleMode={setRescheduleMode}
                onDateChange={setSelectedDate}
                onSlotSelect={setNewStartUtc}
                onReschedule={() => void reschedule()}
                onAddToGoogle={addToGoogleCalendar}
                onDownloadIcs={downloadIcs}
                onCancelClick={() => setCancelOpen(true)}
                onReviewSubmitted={() => {
                  void api<ReviewMeta>(`/reviews/manage/${token}`).then(setReviewMeta);
                }}
              />
            </div>
            <ManageAppointmentSidebar
              appt={appt}
              onReschedule={() => setRescheduleMode(true)}
              onAddToGoogle={addToGoogleCalendar}
              onDownloadIcs={downloadIcs}
              canModify={canModify}
              reschedulesLeft={reschedulesLeft}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel appointment?"
        description="This action cannot be undone. You may need to book again for a new time."
        confirmLabel="Yes, cancel"
        variant="destructive"
        loading={loading}
        onConfirm={() => void cancel()}
      />
    </div>
  );
}

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <div className={cn(pageContainer, 'py-16')}>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-2xl" />
        </div>
      }
    >
      <ManagePageContent />
    </Suspense>
  );
}
