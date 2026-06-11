'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatInTimeZone } from 'date-fns-tz';
import {
  resolveInitialCustomerTimezone,
  saveBookingTimezone,
} from '@/lib/booking-timezone';
import { AppointmentTimeSummary } from '@/components/booking/AppointmentTimeSummary';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/booking-dates';
import { toast } from 'sonner';
import { api, ensureCsrf, fetchMe } from '@/lib/api';
import {
  bookingDetailsSchema,
  type BookingDetailsFormValues,
} from '@/lib/booking-details-schema';
import {
  buildIntakePayload,
  validateIntakeFields,
  type BookingIntakeField,
} from '@/lib/booking-intake';
import { formatMoneyFromCents, normalizeBookingCurrency } from '@/lib/currency';
import {
  countryFromTimezone,
  normalizePhoneValue,
  toPhoneInputCountry,
} from '@/lib/phone';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/Label';
import { Skeleton } from '@/components/ui/skeleton';
import { ReminderPreferencesEditor } from '@/components/shared/ReminderPreferencesEditor';
import {
  DEFAULT_REMINDER_OFFSETS_MINUTES,
  filterReminderOffsetsToAllowed,
  getApplicableReminderOffsets,
  pickReminderSelectionForAppointment,
} from '@pkg/shared-types';
import { BookingWizardLayout } from '@/components/booking/BookingWizardLayout';
import { BookingSummaryPanel } from '@/components/booking/BookingSummaryPanel';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { DateTimePicker } from '@/components/booking/DateTimePicker';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { IntakeFieldsForm } from '@/components/booking/IntakeFieldsForm';
import { PartnerBookingConfirmStep } from '@/components/booking/PartnerBookingConfirmStep';
import { PartnerEventMeta } from '@/components/booking/PartnerEventMeta';
import { WaitlistJoinPanel } from '@/components/booking/WaitlistJoinPanel';
import {
  CustomerAssistantChat,
  type CustomerAssistantAction,
} from '@/components/ai/CustomerAssistantChat';
import {
  WaitlistConfirmation,
  type WaitlistJoinedInfo,
} from '@/components/booking/WaitlistConfirmation';
import { withTenantPath } from '@/lib/resolve-org-slug';

type Slot = { startUtc: string; endUtc: string; status?: 'available' | 'booked' };

const BOOKING_PAYMENTS_ENABLED = false;

const partnerStepMotion = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

type BookingEventContext = {
  organization: { name: string; slug: string };
  branding: { logoUrl?: string | null; primaryColor: string; currency?: string };
  location: {
    id: string;
    name: string;
    timezone: string;
    bookingWindowDays: number;
    address?: string | null;
    reminderOffsetsMinutes?: number[];
  };
  service: {
    id: string;
    name: string;
    description?: string | null;
    durationMinutes: number;
    priceCents?: number | null;
    productKey?: string | null;
    intakeFields: BookingIntakeField[];
  };
  provider: { id: string; name: string; bio?: string | null };
};

export type FilledBookingParams = {
  org?: string;
  serviceId?: string;
  providerId?: string;
  providerSlug?: string;
  serviceSlug?: string;
  source?: string;
  campaign?: string;
  product?: string;
  returnUrl?: string;
  ref?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  initialDate?: string;
  initialStartUtc?: string;
  partner?: boolean;
  leadLabel?: string;
  embed?: boolean;
};

export function FilledBooking({ params }: { params: FilledBookingParams }) {
  const org = params.org?.trim();
  if (!org) {
    return <OrgRequiredGate />;
  }
  const [ctx, setCtx] = useState<BookingEventContext | null>(null);
  const [loadError, setLoadError] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const [customerTimezone, setCustomerTimezone] = useState(() =>
    resolveInitialCustomerTimezone(),
  );

  const phoneDefaultCountry = useMemo(
    () => countryFromTimezone(customerTimezone),
    [customerTimezone],
  );
  const [selectedDate, setSelectedDate] = useState('');
  const [startUtc, setStartUtc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slotUnavailable, setSlotUnavailable] = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState<WaitlistJoinedInfo | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, unknown> | null>(null);
  const [paymentWaived, setPaymentWaived] = useState(false);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [intakeErrors, setIntakeErrors] = useState<Record<string, string>>({});
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderSelectedMinutes, setReminderSelectedMinutes] = useState<number[]>([
    ...DEFAULT_REMINDER_OFFSETS_MINUTES,
  ]);

  const primaryColor = ctx?.branding.primaryColor ?? '#4f46e5';
  const locationId = ctx?.location.id ?? '';
  const serviceId = ctx?.service.id ?? params.serviceId ?? '';
  const providerId = ctx?.provider.id ?? params.providerId ?? '';
  const locationReminderDefaults =
    ctx?.location.reminderOffsetsMinutes ?? DEFAULT_REMINDER_OFFSETS_MINUTES;
  const priceCents = ctx?.service.priceCents ?? 0;
  const needsPayment = BOOKING_PAYMENTS_ENABLED && priceCents > 0;
  const bookingCurrency = normalizeBookingCurrency(ctx?.branding?.currency);

  const initialPrefillPhone = params.customerPhone?.trim()
    ? normalizePhoneValue(
        params.customerPhone,
        countryFromTimezone(resolveInitialCustomerTimezone()),
      )
    : '';

  const detailsForm = useForm<BookingDetailsFormValues>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: {
      customerName: params.customerName?.trim() ?? '',
      customerEmail: params.customerEmail?.trim() ?? '',
      customerPhone: initialPrefillPhone,
    },
  });

  const customerName = detailsForm.watch('customerName');
  const customerEmail = detailsForm.watch('customerEmail');
  const customerPhone = detailsForm.watch('customerPhone');

  const applicableReminderOffsets = useMemo(() => {
    if (!startUtc) return [];
    return getApplicableReminderOffsets(locationReminderDefaults, startUtc);
  }, [startUtc, locationReminderDefaults]);

  const locationTz = ctx?.location.timezone ?? timezone;
  const minBookDate = calendarDateInTimezone(locationTz);
  const maxBookDate = useMemo(() => {
    const days = ctx?.location.bookingWindowDays ?? 60;
    return addCalendarDays(minBookDate, days, locationTz);
  }, [ctx?.location.bookingWindowDays, locationTz, minBookDate]);

  const displaySlots = useMemo(
    () =>
      [...slots]
        .filter((s) => s.status === 'available' || s.status === 'booked')
        .sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [slots],
  );

  const dateTimeLabel =
    startUtc && formatInTimeZone(new Date(startUtc), customerTimezone, 'PPpp');

  const handleCustomerTimezoneChange = (tz: string) => {
    saveBookingTimezone(tz);
    setCustomerTimezone(tz);
  };

  useEffect(() => {
    const prefillName = params.customerName?.trim() ?? '';
    const prefillEmail = params.customerEmail?.trim() ?? '';
    const prefillPhone = params.customerPhone?.trim()
      ? normalizePhoneValue(params.customerPhone, phoneDefaultCountry)
      : '';
    const hasUrlPrefill = Boolean(prefillName || prefillEmail || prefillPhone);

    if (hasUrlPrefill) {
      detailsForm.reset({
        customerName: prefillName,
        customerEmail: prefillEmail,
        customerPhone: prefillPhone,
      });
    }

    if (params.partner) {
      return;
    }

    fetchMe()
      .then((u) => {
        if (hasUrlPrefill) return;
        detailsForm.reset({
          customerName: u.name,
          customerEmail: u.email,
          customerPhone: '',
        });
        const prefs = u.reminderPreferences;
        if (prefs) {
          setRemindersEnabled(prefs.remindersEnabled);
          if (prefs.reminderOffsetsMinutes?.length) {
            setReminderSelectedMinutes(prefs.reminderOffsetsMinutes);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bySlug = params.providerSlug && params.serviceSlug;
    const byId = params.serviceId && params.providerId;
    if (!bySlug && !byId) {
      setLoadError('Invalid booking link');
      return;
    }

    const q = new URLSearchParams({ org });
    if (bySlug) {
      q.set('providerSlug', params.providerSlug!);
      q.set('serviceSlug', params.serviceSlug!);
    } else {
      q.set('serviceId', params.serviceId!);
      q.set('providerId', params.providerId!);
    }

    api<BookingEventContext>(`/integration/booking-event?${q}`)
      .then((c) => {
        setCtx(c);
        setTimezone(c.location.timezone);
        setCustomerTimezone(resolveInitialCustomerTimezone(c.location.timezone));
        const defaults = c.location.reminderOffsetsMinutes ?? [...DEFAULT_REMINDER_OFFSETS_MINUTES];
        setReminderSelectedMinutes(defaults);
        setRemindersEnabled(defaults.length > 0);

        const today = calendarDateInTimezone(c.location.timezone);
        setSelectedDate((prev) => prev || params.initialDate || today);
        if (params.initialStartUtc) {
          setStartUtc(params.initialStartUtc);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load booking'));
  }, [org, params.serviceId, params.providerId, params.providerSlug, params.serviceSlug]);

  useEffect(() => {
    if (!startUtc) return;
    setReminderSelectedMinutes((prev) =>
      pickReminderSelectionForAppointment(applicableReminderOffsets, prev),
    );
    setRemindersEnabled(applicableReminderOffsets.length > 0);
  }, [startUtc, applicableReminderOffsets]);

  useEffect(() => {
    if (!locationId || !serviceId || !providerId || !selectedDate) return;
    setSlotsLoading(true);
    api<{ slots: Slot[]; timezone: string }>(
      `/availability/slots?locationId=${locationId}&serviceId=${serviceId}&providerId=${providerId}&fromDate=${selectedDate}&toDate=${selectedDate}`,
    )
      .then((r) => {
        setSlots(r.slots);
        setTimezone(r.timezone);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load times'))
      .finally(() => setSlotsLoading(false));
  }, [locationId, serviceId, providerId, selectedDate]);

  const handleDateChange = useCallback((value: string) => {
    setSelectedDate(value);
    setStartUtc('');
    setError('');
  }, []);

  function handleAssistantAction(action: CustomerAssistantAction) {
    switch (action.type) {
      case 'selectDate':
        setSelectedDate(action.payload.date);
        setStartUtc('');
        setError('');
        break;
      case 'selectSlot':
        setSelectedDate(action.payload.date);
        setStartUtc(action.payload.startUtc);
        setError('');
        break;
      case 'goToStep':
        if (action.payload.step === 'dateTime') {
          setStartUtc('');
        }
        break;
      default:
        break;
    }
  }

  async function joinWaitlist() {
    const values = detailsForm.getValues();
    if (!values.customerEmail?.trim() || !values.customerName?.trim()) {
      setError('Enter your name and email to join the waitlist.');
      return;
    }
    if (!selectedDate) {
      setError('Select a date first.');
      return;
    }
    setError('');
    setWaitlistJoining(true);
    try {
      await ensureCsrf();
      await api('/appointments/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          serviceId,
          providerId,
          preferredDate: selectedDate,
          ...(startUtc ? { preferredStartUtc: startUtc } : {}),
          customerEmail: values.customerEmail,
          customerName: values.customerName,
          customerPhone: values.customerPhone?.trim() || undefined,
        }),
      });
      setSlotUnavailable(false);
      setWaitlistJoined({
        preferredDate: selectedDate,
        preferredTimeLabel: startUtc
          ? formatInTimeZone(new Date(startUtc), customerTimezone, 'h:mm a')
          : 'Any time',
        serviceName: ctx?.service.name ?? 'your service',
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone?.trim() || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Waitlist failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setWaitlistJoining(false);
    }
  }

  const availableSlotCount = displaySlots.filter((s) => s.status === 'available').length;
  const dayFullyBooked =
    Boolean(selectedDate) && !slotsLoading && availableSlotCount === 0;

  async function submitBooking(skipPaymentCheck = false) {
    const valid = await detailsForm.trigger();
    if (!valid) return;

    const intakeErrs = validateIntakeFields(ctx?.service.intakeFields ?? [], intakeAnswers);
    if (Object.keys(intakeErrs).length > 0) {
      setIntakeErrors(intakeErrs);
      return;
    }
    setIntakeErrors({});

    const values = detailsForm.getValues();
    setLoading(true);
    setError('');
    setSlotUnavailable(false);
    try {
      if (!startUtc) {
        setError('Please select a time slot.');
        return;
      }

      const fresh = await api<{ slots: Slot[] }>(
        `/availability/slots?locationId=${locationId}&serviceId=${serviceId}&providerId=${providerId}&fromDate=${selectedDate}&toDate=${selectedDate}`,
      );
      const stillAvailable = fresh.slots.some(
        (s) =>
          (s.status ?? 'available') === 'available' &&
          Math.abs(new Date(s.startUtc).getTime() - new Date(startUtc).getTime()) < 60_000,
      );
      if (!stillAvailable) {
        setSlots(fresh.slots);
        setSlotUnavailable(true);
        setError('This time is no longer available. Please choose another slot.');
        return;
      }

      if (needsPayment && !skipPaymentCheck && !paymentWaived) {
        setError('Please complete payment first.');
        return;
      }

      const allowedReminders = getApplicableReminderOffsets(
        locationReminderDefaults,
        startUtc,
      );
      const effectiveReminderMinutes = remindersEnabled
        ? filterReminderOffsetsToAllowed(reminderSelectedMinutes, allowedReminders)
        : [];
      if (
        remindersEnabled &&
        allowedReminders.length > 0 &&
        effectiveReminderMinutes.length === 0
      ) {
        setError('Select at least one reminder time, or turn reminders off.');
        return;
      }

      await ensureCsrf();
      const result = await api<Record<string, unknown>>('/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          serviceId,
          providerId,
          startUtc,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          customerTimezone,
          idempotencyKey: crypto.randomUUID(),
          stripePaymentIntentId: paymentWaived ? 'dev_waived' : undefined,
          product: params.product ?? ctx?.service.productKey ?? undefined,
          campaign: params.campaign,
          source: params.embed ? 'embed-event' : params.source ?? 'event',
          returnUrl: params.returnUrl,
          metadata: JSON.stringify({
            org,
            source: params.source,
            campaign: params.campaign,
            ref: params.ref,
            bookingType: 'filled',
          }),
          intakeResponses: buildIntakePayload(intakeAnswers),
          remindersEnabled:
            allowedReminders.length > 0
              ? remindersEnabled && effectiveReminderMinutes.length > 0
              : false,
          reminderOffsetsMinutes: effectiveReminderMinutes,
        }),
      });
      setConfirmed(result);
      toast.success('Appointment booked successfully');
      if (params.returnUrl && typeof window !== 'undefined') {
        const url = new URL(params.returnUrl);
        url.searchParams.set('booked', 'true');
        url.searchParams.set('appointmentId', String(result.id ?? ''));
        setTimeout(() => {
          window.location.href = url.toString();
        }, 2000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Booking failed';
      setError(msg);
      toast.error(msg);
      if (msg.toLowerCase().includes('no longer available')) setSlotUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  async function payAndBook() {
    if (!needsPayment) {
      await submitBooking();
      return;
    }

    const valid = await detailsForm.trigger();
    if (!valid) return;

    const intakeErrs = validateIntakeFields(ctx?.service.intakeFields ?? [], intakeAnswers);
    if (Object.keys(intakeErrs).length > 0) {
      setIntakeErrors(intakeErrs);
      return;
    }

    const values = detailsForm.getValues();
    setLoading(true);
    setError('');
    try {
      if (!startUtc) {
        setError('Please select a time slot.');
        return;
      }

      await ensureCsrf();
      const checkout = await api<{
        required: boolean;
        devMode?: boolean;
        url?: string | null;
      }>('/payments/booking-checkout', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          serviceId,
          providerId,
          startUtc,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerPhone: values.customerPhone,
          customerTimezone,
          idempotencyKey: crypto.randomUUID(),
          product: params.product ?? ctx?.service.productKey,
          campaign: params.campaign,
          source: params.embed ? 'embed-event' : params.source ?? 'event',
          returnUrl: params.returnUrl,
          org,
          metadata: JSON.stringify({
            org,
            source: params.source,
            campaign: params.campaign,
            ref: params.ref,
            bookingType: 'filled',
          }),
          intakeResponses: JSON.stringify(buildIntakePayload(intakeAnswers)),
        }),
      });

      if (checkout.devMode || !checkout.url) {
        setPaymentWaived(true);
        await submitBooking(true);
        return;
      }

      window.location.href = checkout.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start payment';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (waitlistJoined) {
    const bookAgain =
      org && serviceId && providerId
        ? withTenantPath(
            `/book/event?serviceId=${encodeURIComponent(serviceId)}&providerId=${encodeURIComponent(providerId)}`,
            org,
          )
        : undefined;
    return (
      <WaitlistConfirmation
        info={waitlistJoined}
        primaryColor={primaryColor}
        bookAgainHref={bookAgain}
        embed={params.embed}
      />
    );
  }

  if (confirmed) {
    return (
      <BookingConfirmation
        confirmed={confirmed}
        primaryColor={primaryColor}
        embed={params.embed}
        returnUrl={params.returnUrl}
      />
    );
  }

  if (loadError) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="py-10 text-center">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Booking link unavailable
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
          <Link href={withTenantPath('/book', org)} className="mt-6 inline-block">
            <Button variant="outline">Browse all booking options</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (!ctx) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const confirmButton = (
    <Button
      type="button"
      disabled={loading || !startUtc}
      className="w-full"
      style={{ backgroundColor: primaryColor }}
      onClick={() => void payAndBook()}
    >
      {loading
        ? 'Please wait...'
        : needsPayment
          ? `Pay & book (${formatMoneyFromCents(priceCents, bookingCurrency)})`
          : 'Confirm appointment'}
    </Button>
  );

  const partnerShowConfirm = Boolean(params.partner && startUtc);

  if (params.partner) {
    return (
      <div className="flex w-full min-h-[500px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-950">
        {error && (
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <Alert>{error}</Alert>
          </div>
        )}
        {slotUnavailable && (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm dark:border-amber-900/70 dark:bg-amber-950/40">
            <p className="text-amber-900 dark:text-amber-200">This slot was just taken.</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => void joinWaitlist()}>
              Join waitlist
            </Button>
          </div>
        )}

        <div className="relative min-h-[480px] flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {partnerShowConfirm ? (
              <motion.div
                key="confirm"
                className="h-full w-full"
                {...partnerStepMotion}
              >
                <PartnerBookingConfirmStep
                  ctx={ctx}
                  startUtc={startUtc}
                  customerTimezone={customerTimezone}
                  leadLabel={params.leadLabel}
                  primaryColor={primaryColor}
                  form={detailsForm}
                  intakeAnswers={intakeAnswers}
                  intakeErrors={intakeErrors}
                  onIntakeChange={(fieldId, value) =>
                    setIntakeAnswers((a) => ({ ...a, [fieldId]: value }))
                  }
                  remindersEnabled={remindersEnabled}
                  reminderSelectedMinutes={filterReminderOffsetsToAllowed(
                    reminderSelectedMinutes,
                    applicableReminderOffsets,
                  )}
                  applicableReminderOffsets={applicableReminderOffsets}
                  onRemindersEnabledChange={setRemindersEnabled}
                  onReminderSelectedChange={setReminderSelectedMinutes}
                  showReminders={applicableReminderOffsets.length > 0}
                  needsPayment={needsPayment}
                  priceCents={priceCents}
                  loading={loading}
                  onBack={() => {
                    setStartUtc('');
                    setError('');
                  }}
                  onConfirm={() => void payAndBook()}
                />
              </motion.div>
            ) : (
              <motion.div
                key="datetime"
                className="flex h-full min-h-[480px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(240px,320px)_1fr]"
                {...partnerStepMotion}
              >
                <div className="h-full min-h-[480px] border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
                  <PartnerEventMeta
                    serviceName={ctx.service.name}
                    durationMinutes={ctx.service.durationMinutes}
                    providerName={ctx.provider.name}
                    locationName={ctx.location.name}
                    locationTimezone={timezone}
                    customerTimezone={customerTimezone}
                    onCustomerTimezoneChange={handleCustomerTimezoneChange}
                    leadLabel={params.leadLabel}
                    accentColor={primaryColor}
                  />
                </div>
                <div className="h-full min-h-[480px]">
                  <DateTimePicker
                    layout="split"
                    locationTimezone={timezone}
                    customerTimezone={customerTimezone}
                    onCustomerTimezoneChange={handleCustomerTimezoneChange}
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    startUtc={startUtc}
                    onSlotSelect={setStartUtc}
                    slots={displaySlots}
                    loading={slotsLoading}
                    minDate={minBookDate}
                    maxDate={maxBookDate}
                    accentColor={primaryColor}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const summaryPanel = (
    <BookingSummaryPanel
      accentColor={primaryColor}
      data={{
        locationName: ctx.location.name,
        serviceName: ctx.service.name,
        serviceDuration: ctx.service.durationMinutes,
        providerLabel: ctx.provider.name,
        dateTimeLabel,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
      }}
    />
  );

  const header = (
    <>
      <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          {ctx.service.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          with {ctx.provider.name}
          {ctx.service.durationMinutes ? ` · ${ctx.service.durationMinutes} min` : ''}
        </p>
        {ctx.service.description && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ctx.service.description}</p>
        )}
        {params.leadLabel && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            For <span className="font-medium text-slate-800 dark:text-slate-100">{params.leadLabel}</span>
          </p>
        )}
        {params.source && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Referred from <span className="font-medium">{params.source}</span>
          </p>
        )}
      </div>
    </>
  );

  return (
    <BookingWizardLayout summary={summaryPanel} header={header}>
      <Card>
        <CardBody className="space-y-6">
          {error && <Alert>{error}</Alert>}
          {slotUnavailable && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/70 dark:bg-amber-950/40">
              <p className="text-amber-900 dark:text-amber-200">This slot was just taken.</p>
              <Button type="button" variant="outline" className="mt-2" onClick={() => void joinWaitlist()}>
                Join waitlist
              </Button>
            </div>
          )}

          <DateTimePicker
            locationTimezone={timezone}
            customerTimezone={customerTimezone}
            onCustomerTimezoneChange={handleCustomerTimezoneChange}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            startUtc={startUtc}
            onSlotSelect={setStartUtc}
            slots={displaySlots}
            loading={slotsLoading}
            minDate={minBookDate}
            maxDate={maxBookDate}
            accentColor={primaryColor}
          />

          {dayFullyBooked && (
            <WaitlistJoinPanel
              selectedDate={selectedDate}
              hasPreferredTime={Boolean(startUtc)}
              variant={
                detailsForm.getValues('customerName')?.trim() &&
                detailsForm.getValues('customerEmail')?.trim()
                  ? 'action'
                  : 'guide'
              }
              guideContext="inline"
              loading={waitlistJoining}
              onJoin={() => void joinWaitlist()}
            />
          )}

          <form
            className="space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800"
            onSubmit={(e) => e.preventDefault()}
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Your details
            </h3>
            <div>
              <Label htmlFor="filled-name">Full name</Label>
              <Input
                id="filled-name"
                className="mt-1.5"
                {...detailsForm.register('customerName')}
                aria-invalid={!!detailsForm.formState.errors.customerName}
              />
              {detailsForm.formState.errors.customerName && (
                <p className="mt-1 text-sm text-red-600">
                  {detailsForm.formState.errors.customerName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="filled-email">Email</Label>
              <Input
                id="filled-email"
                type="email"
                className="mt-1.5"
                {...detailsForm.register('customerEmail')}
                aria-invalid={!!detailsForm.formState.errors.customerEmail}
              />
              {detailsForm.formState.errors.customerEmail && (
                <p className="mt-1 text-sm text-red-600">
                  {detailsForm.formState.errors.customerEmail.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="filled-phone">Phone</Label>
              <div className="mt-1.5">
                <Controller
                  name="customerPhone"
                  control={detailsForm.control}
                  render={({ field }) => (
                    <PhoneInput
                      id="filled-phone"
                      required
                      value={field.value}
                      defaultCountry={
                        phoneDefaultCountry
                          ? toPhoneInputCountry(phoneDefaultCountry)
                          : undefined
                      }
                      onChange={(value) => field.onChange(value ?? '')}
                      onBlur={field.onBlur}
                      invalid={!!detailsForm.formState.errors.customerPhone}
                    />
                  )}
                />
              </div>
              {detailsForm.formState.errors.customerPhone && (
                <p className="mt-1 text-sm text-red-600">
                  {detailsForm.formState.errors.customerPhone.message}
                </p>
              )}
            </div>

            {startUtc && (
              <AppointmentTimeSummary
                startUtc={startUtc}
                endUtc={
                  ctx.service.durationMinutes
                    ? new Date(
                        new Date(startUtc).getTime() + ctx.service.durationMinutes * 60_000,
                      ).toISOString()
                    : undefined
                }
                customerTimezone={customerTimezone}
                officeTimezone={timezone}
              />
            )}

            {startUtc && applicableReminderOffsets.length > 0 && (
              <ReminderPreferencesEditor
                enabled={remindersEnabled}
                selectedMinutes={filterReminderOffsetsToAllowed(
                  reminderSelectedMinutes,
                  applicableReminderOffsets,
                )}
                allowedMinutes={applicableReminderOffsets}
                onEnabledChange={setRemindersEnabled}
                onSelectedChange={setReminderSelectedMinutes}
                description="Choose when you want reminders before this appointment."
              />
            )}

            <IntakeFieldsForm
              fields={ctx.service.intakeFields}
              answers={intakeAnswers}
              errors={intakeErrors}
              onChange={(fieldId, value) =>
                setIntakeAnswers((a) => ({ ...a, [fieldId]: value }))
              }
            />

            {needsPayment && (
              <p className="text-sm text-text-secondary">
                You will pay securely on Stripe, then your appointment is confirmed automatically.
              </p>
            )}

            {confirmButton}
          </form>
        </CardBody>
      </Card>
      <CustomerAssistantChat
        primaryColor={primaryColor}
        context={{
          org,
          page: 'filled-booking',
          step: startUtc ? 'details' : 'dateTime',
          state: {
            locationId,
            serviceId,
            providerId,
            selectedDate: selectedDate || undefined,
            startUtc: startUtc || undefined,
            customerTimezone,
          },
        }}
        onAction={handleAssistantAction}
      />
    </BookingWizardLayout>
  );
}
