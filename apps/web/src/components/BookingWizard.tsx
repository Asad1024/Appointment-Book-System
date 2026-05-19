'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import { api, ensureCsrf, fetchMe } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { BookingWizardLayout } from '@/components/booking/BookingWizardLayout';
import { BookingSummaryPanel } from '@/components/booking/BookingSummaryPanel';
import { DateTimePicker } from '@/components/booking/DateTimePicker';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { WizardStepNav } from '@/components/booking/WizardStepNav';
import { cn } from '@/lib/utils';
import { formatMoneyFromCents, normalizeBookingCurrency } from '@/lib/currency';

type Location = {
  id: string;
  name: string;
  timezone: string;
  bookingWindowDays?: number;
  address?: string | null;
};
type IntakeField = {
  id: string;
  label: string;
  helpText?: string | null;
  type: string;
  options?: string[] | null;
  required: boolean;
  order: number;
};

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  description?: string;
  productKey?: string;
  priceCents?: number | null;
  intakeFields?: IntakeField[];
};
type Provider = { id: string; name: string };
type Slot = { startUtc: string; endUtc: string };

type IntegrationContext = {
  branding: { logoUrl?: string; primaryColor: string; currency?: string };
  locations: Location[];
  location: Location;
  services: Service[];
  product: string | null;
};

export type BookingParams = {
  org?: string;
  product?: string;
  locationId?: string;
  source?: string;
  campaign?: string;
  returnUrl?: string;
  embed?: boolean;
};

const BASE_STEPS = ['Service', 'Provider', 'Date & time', 'Details', 'Confirm'];
const WIZARD_STORAGE_KEY = 'slotwise_booking_wizard';

const detailsSchema = z.object({
  customerName: z.string().min(2, 'Please enter your full name'),
  customerEmail: z.string().email('Please enter a valid email'),
  customerPhone: z
    .string()
    .min(8, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(/^\+?[\d\s\-()]+$/, 'Use digits with optional country code, e.g. +971501234567'),
});

type DetailsFormValues = z.infer<typeof detailsSchema>;

const stepMotion = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

const selectedChoiceClass =
  'border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/30 dark:border-brand-600 dark:bg-brand-950/35 dark:ring-brand-700/40';

export function BookingWizard({ params }: { params: BookingParams }) {
  const org = params.org ?? 'demo-company';
  const [step, setStep] = useState(0);
  const [ctx, setCtx] = useState<IntegrationContext | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [customerTimezone, setCustomerTimezone] = useState(
    typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slotUnavailable, setSlotUnavailable] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, unknown> | null>(null);

  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startUtc, setStartUtc] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentWaived, setPaymentWaived] = useState(false);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [intakeErrors, setIntakeErrors] = useState<Record<string, string>>({});

  const locations = ctx?.locations ?? [];
  const hasLocationStep = locations.length > 1;
  const stepOffset = hasLocationStep ? 1 : 0;
  const services = ctx?.services ?? [];
  const primaryColor = ctx?.branding.primaryColor ?? '#4f46e5';
  const selectedLocation = locations.find((l) => l.id === locationId) ?? ctx?.location;
  const selectedService = services.find((s) => s.id === serviceId);
  const hasIntakeStep = (selectedService?.intakeFields?.length ?? 0) > 0;
  const steps = useMemo(() => {
    const base = hasLocationStep ? ['Location', ...BASE_STEPS] : [...BASE_STEPS];
    if (hasIntakeStep) {
      const idx = base.indexOf('Confirm');
      base.splice(idx, 0, 'Tell us more');
    }
    return base;
  }, [hasLocationStep, hasIntakeStep]);
  const selectedProvider = providers.find((p) => p.id === providerId);
  const priceCents = selectedService?.priceCents ?? 0;
  const needsPayment = priceCents > 0;
  const bookingCurrency = normalizeBookingCurrency(ctx?.branding?.currency);

  const loadContext = useCallback(
    (locId?: string) => {
      const q = new URLSearchParams();
      q.set('org', org);
      if (params.product) q.set('product', params.product);
      if (locId) q.set('locationId', locId);
      return api<IntegrationContext>(`/integration/context?${q}`);
    },
    [org, params.product],
  );

  const detailsForm = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
    },
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, string | number>;
        if (saved.step != null) setStep(Number(saved.step));
        if (saved.serviceId) setServiceId(String(saved.serviceId));
        if (saved.providerId) setProviderId(String(saved.providerId));
        if (saved.selectedDate) setSelectedDate(String(saved.selectedDate));
        if (saved.startUtc) setStartUtc(String(saved.startUtc));
        if (saved.customerTimezone) setCustomerTimezone(String(saved.customerTimezone));
      }
    } catch {
      /* ignore */
    }
    fetchMe()
      .then((u) => {
        setCustomerEmail(u.email);
        setCustomerName(u.name);
        detailsForm.reset({
          customerName: u.name,
          customerEmail: u.email,
          customerPhone: '',
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const max = steps.length - 1;
    setStep((s) => Math.min(Math.max(0, s), max));
  }, [steps.length, hasIntakeStep, serviceId]);

  useEffect(() => {
    sessionStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({
        step,
        serviceId,
        providerId,
        selectedDate,
        startUtc,
        customerTimezone,
        locationId,
      }),
    );
  }, [step, serviceId, providerId, selectedDate, startUtc, customerTimezone, locationId]);

  useEffect(() => {
    const initialLocId = params.locationId;
    loadContext(initialLocId)
      .then((c) => {
        setCtx(c);
        const multi = c.locations.length > 1;
        const pick =
          (initialLocId && c.locations.find((l) => l.id === initialLocId)?.id) ||
          (multi ? '' : c.location.id);
        if (pick) {
          setLocationId(pick);
          setTimezone(c.location.timezone);
          if (!multi && c.services.length === 1) {
            setServiceId(c.services[0].id);
          }
          if (!multi) {
            setStep(stepOffset);
          }
        } else if (multi) {
          setLocationId('');
          setStep(0);
        }
      })
      .catch((e) => setError(e.message));
  }, [org, params.product, params.locationId, loadContext]);

  function selectLocation(loc: Location) {
    setLocationId(loc.id);
    setTimezone(loc.timezone);
    setServiceId('');
    setProviderId('');
    setSelectedDate('');
    setStartUtc('');
    setError('');
    loadContext(loc.id)
      .then((c) => {
        setCtx(c);
        if (c.services.length === 1) {
          setServiceId(c.services[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    if (!locationId || !serviceId) return;
    const q = params.product ? `?serviceId=${serviceId}&product=${params.product}` : `?serviceId=${serviceId}`;
    api<Provider[]>(`/catalog/locations/${locationId}/providers${q}`)
      .then((p) => {
        setProviders(p);
        if (p.length === 1) setProviderId(p[0].id);
      })
      .catch((e) => setError(e.message));
  }, [locationId, serviceId, params.product]);

  useEffect(() => {
    if (!locationId || !serviceId || !providerId || !selectedDate) return;
    setLoading(true);
    api<{ slots: Slot[]; timezone: string }>(
      `/availability/slots?locationId=${locationId}&serviceId=${serviceId}&providerId=${providerId}&fromDate=${selectedDate}&toDate=${selectedDate}`,
    )
      .then((r) => {
        setSlots(r.slots);
        setTimezone(r.timezone);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId, serviceId, providerId, selectedDate]);

  useEffect(() => {
    if (step === stepOffset + 3) {
      detailsForm.reset({ customerName, customerEmail, customerPhone });
    }
  }, [step, stepOffset, customerName, customerEmail, customerPhone, detailsForm]);

  const maxBookDate = (() => {
    const days = ctx?.location.bookingWindowDays ?? 60;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  })();
  const minBookDate = new Date().toISOString().slice(0, 10);

  const providerLabel =
    providerId === 'any' ? 'Any available' : selectedProvider?.name;
  const dateTimeLabel =
    startUtc && formatInTimeZone(new Date(startUtc), customerTimezone, 'PPpp');

  const summaryPanel = (
    <BookingSummaryPanel
      accentColor={primaryColor}
      data={{
        locationName: selectedLocation?.name,
        serviceName: selectedService?.name,
        serviceDuration: selectedService?.durationMinutes,
        providerLabel: providerId ? providerLabel : undefined,
        dateTimeLabel,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
      }}
    />
  );

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setStartUtc('');
  }

  const confirmStep = stepOffset + (hasIntakeStep ? 5 : 4);
  const intakeStep = stepOffset + 4;

  function onDetailsSubmit(values: DetailsFormValues) {
    setCustomerName(values.customerName);
    setCustomerEmail(values.customerEmail);
    setCustomerPhone(values.customerPhone ?? '');
    setStep(hasIntakeStep ? intakeStep : confirmStep);
  }

  function parseCheckboxSelection(raw?: string): string[] {
    if (!raw?.trim()) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  function isIntakeValueEmpty(type: string, value: string): boolean {
    if (!value.trim()) return true;
    if (type === 'checkbox') return parseCheckboxSelection(value).length === 0;
    return false;
  }

  function validateIntake(): boolean {
    const fields = selectedService?.intakeFields ?? [];
    const errors: Record<string, string> = {};
    for (const f of fields) {
      const v = intakeAnswers[f.id]?.trim() ?? '';
      if (f.required && isIntakeValueEmpty(f.type, v)) {
        errors[f.id] = `${f.label} is required`;
      }
    }
    setIntakeErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function intakePayload() {
    return Object.entries(intakeAnswers)
      .filter(([, v]) => v.trim())
      .map(([fieldId, value]) => ({ fieldId, value }));
  }

  async function joinWaitlist() {
    setError('');
    try {
      await ensureCsrf();
      await api('/appointments/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          serviceId,
          providerId: providerId === 'any' ? undefined : providerId,
          preferredDate: selectedDate,
          customerEmail,
          customerName,
        }),
      });
      setSlotUnavailable(false);
      toast.success('Added to the waitlist. We will email you if a slot opens.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Waitlist failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function payAndBook() {
    if (!needsPayment) {
      await submitBooking();
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!startUtc) {
        setError('Please select a time slot.');
        setStep(stepOffset + 2);
        return;
      }

      await ensureCsrf();
      const idempotencyKey = crypto.randomUUID();
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
          customerName,
          customerEmail,
          customerPhone,
          customerTimezone,
          idempotencyKey,
          product: params.product,
          campaign: params.campaign,
          source: params.embed ? 'embed' : params.source ?? 'web',
          returnUrl: params.returnUrl,
          org,
          metadata: JSON.stringify({ org, source: params.source, campaign: params.campaign }),
          intakeResponses: JSON.stringify(intakePayload()),
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

  async function submitBooking(skipPaymentCheck = false) {
    setLoading(true);
    setError('');
    setSlotUnavailable(false);
    try {
      if (!startUtc) {
        setError('Please select a time slot.');
        setStep(stepOffset + 2);
        return;
      }

      const fresh = await api<{ slots: Slot[] }>(
        `/availability/slots?locationId=${locationId}&serviceId=${serviceId}&providerId=${providerId}&fromDate=${selectedDate}&toDate=${selectedDate}`,
      );
      const stillAvailable = fresh.slots.some(
        (s) => Math.abs(new Date(s.startUtc).getTime() - new Date(startUtc).getTime()) < 60_000,
      );
      if (!stillAvailable) {
        setSlots(fresh.slots);
        setSlotUnavailable(true);
        setError('This time is no longer available. Please choose another slot.');
        setStep(stepOffset + 2);
        return;
      }

      if (needsPayment && !skipPaymentCheck && !paymentWaived) {
        setError('Please complete payment first.');
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
          customerName,
          customerEmail,
          customerPhone,
          customerTimezone,
          idempotencyKey: crypto.randomUUID(),
          stripePaymentIntentId: paymentWaived ? 'dev_waived' : undefined,
          product: params.product,
          campaign: params.campaign,
          source: params.embed ? 'embed' : params.source ?? 'web',
          returnUrl: params.returnUrl,
          metadata: JSON.stringify({ org, source: params.source, campaign: params.campaign }),
          intakeResponses: intakePayload(),
        }),
      });
      sessionStorage.removeItem(WIZARD_STORAGE_KEY);
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

  if (confirmed && !params.returnUrl) {
    const isPending = confirmed.status === 'pending';
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardBody className="py-12">
          {!isPending && <AnimatedCheckmark size={88} />}
          {isPending && (
            <div
              className="mx-auto h-12 w-12 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600 dark:border-brand-900 dark:border-t-brand-400"
              aria-hidden
            />
          )}
          <h2 className="mt-4 font-display text-2xl font-bold" style={{ color: primaryColor }}>
            {isPending ? 'Request received' : "You're all set!"}
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {isPending
              ? 'Pending approval. We will email you when confirmed.'
              : 'Check your email for confirmation details.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={`/manage/${confirmed.manageToken as string}`}>
              <Button style={{ backgroundColor: primaryColor }}>Manage appointment</Button>
            </Link>
            {!params.embed && (
              <Link href="/account">
                <Button variant="outline">My appointments</Button>
              </Link>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (confirmed && params.returnUrl) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardBody className="py-12">
          <AnimatedCheckmark size={72} />
          <p className="mt-4 font-display text-xl font-semibold" style={{ color: primaryColor }}>
            Booking confirmed!
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Redirecting you back...</p>
          <div
            className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
            aria-hidden
          />
        </CardBody>
      </Card>
    );
  }

  const header = (
    <>
      {ctx?.branding.logoUrl && (
        <img src={ctx.branding.logoUrl} alt="" className="h-10 object-contain" />
      )}
      {params.source && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Referred from <span className="font-medium text-slate-700 dark:text-slate-200">{params.source}</span>
        </p>
      )}
    </>
  );

  return (
    <BookingWizardLayout summary={summaryPanel} header={header}>
      <div className="space-y-4">
        <StepIndicator steps={steps} current={step} accentColor={primaryColor} />

        {error && <Alert>{error}</Alert>}
        {slotUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/70 dark:bg-amber-950/40">
            <p className="text-amber-900 dark:text-amber-200">This slot was just taken.</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => void joinWaitlist()}>
              Join waitlist
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardBody>
          <AnimatePresence mode="wait">
            <motion.div key={step} {...stepMotion}>
              {hasLocationStep && step === 0 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Choose a location</h2>
                  <ul className="mt-6 space-y-3">
                    {locations.map((loc) => (
                      <li key={loc.id}>
                        <button
                          type="button"
                          onClick={() => selectLocation(loc)}
                          className={cn(
                            'group w-full rounded-xl border p-4 text-left transition',
                            locationId === loc.id
                              ? selectedChoiceClass
                              : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:border-brand-700 dark:hover:bg-brand-950/35',
                          )}
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                            {loc.name}
                          </span>
                          {loc.address && (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{loc.address}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <WizardStepNav
                    showBack={false}
                    onNext={goNext}
                    nextDisabled={!locationId}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 0 && (!hasLocationStep || locationId) && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Select a service</h2>
                  {services.length === 0 && (
                    <p className="mt-6 text-slate-500 dark:text-slate-400">No services available for this product.</p>
                  )}
                  <ul className="mt-6 space-y-3">
                    {services.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setServiceId(s.id);
                            setIntakeAnswers({});
                            setIntakeErrors({});
                            setPaymentWaived(false);
                            setProviderId('');
                            setSelectedDate('');
                            setStartUtc('');
                          }}
                          className={cn(
                            'group w-full rounded-xl border p-4 text-left transition',
                            serviceId === s.id
                              ? selectedChoiceClass
                              : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:border-brand-700 dark:hover:bg-brand-950/35',
                          )}
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                            {s.name}
                          </span>
                          <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                            {s.durationMinutes} min
                            {s.priceCents && s.priceCents > 0
                              ? ` - ${formatMoneyFromCents(s.priceCents, bookingCurrency)}`
                              : ''}
                          </span>
                          {s.description && (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={goNext}
                    nextDisabled={!serviceId}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 1 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Choose your expert</h2>
                  <ul className="mt-6 space-y-3">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setProviderId('any');
                          setSelectedDate('');
                          setStartUtc('');
                        }}
                        className={cn(
                          'w-full rounded-xl border p-4 text-left font-medium transition',
                          providerId === 'any'
                            ? selectedChoiceClass
                            : 'border-brand-200 bg-brand-50/50 hover:border-brand-300 dark:border-brand-800 dark:bg-brand-950/25 dark:hover:border-brand-700 dark:hover:bg-brand-950/40',
                        )}
                      >
                        Any available provider
                      </button>
                    </li>
                    {providers.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setProviderId(p.id);
                            setSelectedDate('');
                            setStartUtc('');
                          }}
                          className={cn(
                            'w-full rounded-xl border p-4 text-left font-medium transition',
                            providerId === p.id
                              ? selectedChoiceClass
                              : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:border-brand-700 dark:hover:bg-brand-950/35',
                          )}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={goNext}
                    nextDisabled={!providerId}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 2 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Pick date & time</h2>
                  <div className="mt-6">
                    <DateTimePicker
                      locationTimezone={timezone}
                      customerTimezone={customerTimezone}
                      onCustomerTimezoneChange={setCustomerTimezone}
                      selectedDate={selectedDate}
                      onDateChange={handleDateChange}
                      startUtc={startUtc}
                      onSlotSelect={setStartUtc}
                      slots={slots}
                      loading={loading}
                      minDate={minBookDate}
                      maxDate={maxBookDate}
                      accentColor={primaryColor}
                    />
                  </div>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={goNext}
                    nextDisabled={!startUtc}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 3 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Your details</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <Link href="/login" className="font-medium text-brand-600 hover:underline">
                      Sign in
                    </Link>{' '}
                    to pre-fill, or continue as guest.
                  </p>
                  <form className="mt-6 space-y-4" onSubmit={detailsForm.handleSubmit(onDetailsSubmit)}>
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
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
                      <Label htmlFor="phone">Phone (required for WhatsApp updates)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        placeholder="+971501234567"
                        {...detailsForm.register('customerPhone')}
                        aria-invalid={!!detailsForm.formState.errors.customerPhone}
                      />
                      {detailsForm.formState.errors.customerPhone && (
                        <p className="mt-1 text-sm text-red-600">
                          {detailsForm.formState.errors.customerPhone.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        We send confirmations by email and WhatsApp.
                      </p>
                    </div>
                  </form>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={() => void detailsForm.handleSubmit(onDetailsSubmit)()}
                    nextLabel={hasIntakeStep ? 'Continue' : 'Continue to review'}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === intakeStep && hasIntakeStep && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Tell us a bit more</h2>
                  <div className="mt-6 space-y-4">
                    {(selectedService?.intakeFields ?? []).map((field) => (
                      <div key={field.id}>
                        <Label className="font-semibold">
                          {field.label}
                          {field.required && <span className="text-red-500"> *</span>}
                        </Label>
                        {field.helpText && (
                          <p className="mt-0.5 text-sm text-text-muted">{field.helpText}</p>
                        )}
                        {field.type === 'textarea' ? (
                          <Textarea
                            className="mt-2"
                            rows={4}
                            value={intakeAnswers[field.id] ?? ''}
                            onChange={(e) =>
                              setIntakeAnswers((a) => ({ ...a, [field.id]: e.target.value }))
                            }
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            value={intakeAnswers[field.id] ?? ''}
                            onValueChange={(v) => setIntakeAnswers((a) => ({ ...a, [field.id]: v }))}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options ?? []).map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === 'checkbox' ? (
                          <div className="mt-2 space-y-2">
                            {(field.options ?? []).map((o) => {
                              const selected = parseCheckboxSelection(intakeAnswers[field.id]);
                              const checked = selected.includes(o);
                              return (
                                <label key={o} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? selected.filter((x) => x !== o)
                                        : [...selected, o];
                                      setIntakeAnswers((a) => ({
                                        ...a,
                                        [field.id]: JSON.stringify(next),
                                      }));
                                    }}
                                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                                  />
                                  {o}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            className="mt-2"
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={intakeAnswers[field.id] ?? ''}
                            onChange={(e) =>
                              setIntakeAnswers((a) => ({ ...a, [field.id]: e.target.value }))
                            }
                          />
                        )}
                        {intakeErrors[field.id] && (
                          <p className="mt-1 text-sm text-red-600">{intakeErrors[field.id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={() => {
                      if (validateIntake()) setStep(confirmStep);
                    }}
                    nextLabel="Continue to review"
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === confirmStep && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Confirm your booking</h2>
                  <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
                    {[
                      ...(hasLocationStep ? [['Location', selectedLocation?.name] as const] : []),
                      ['Service', selectedService?.name],
                      ['Expert', providerId === 'any' ? 'Any available' : selectedProvider?.name],
                      [
                        'When (your time)',
                        startUtc && formatInTimeZone(new Date(startUtc), customerTimezone, 'PPpp'),
                      ],
                      [
                        'When (location)',
                        startUtc && formatInTimeZone(new Date(startUtc), timezone, 'PPpp'),
                      ],
                      ['Name', customerName],
                      ['Email', customerEmail],
                      ['Phone', customerPhone],
                      ...(needsPayment
                        ? [['Price', formatMoneyFromCents(priceCents, bookingCurrency)] as const]
                        : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                        <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {needsPayment && (
                    <p className="mt-4 text-sm text-text-secondary">
                      You will pay securely on Stripe, then your appointment is confirmed automatically.
                    </p>
                  )}
                  <Button
                    type="button"
                    disabled={loading}
                    className="mt-6 w-full"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => void payAndBook()}
                  >
                    {loading
                      ? 'Please wait...'
                      : needsPayment
                        ? `Pay & book (${formatMoneyFromCents(priceCents, bookingCurrency)})`
                        : 'Confirm appointment'}
                  </Button>
                  <WizardStepNav
                    onBack={goBack}
                    showNext={false}
                    primaryColor={primaryColor}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardBody>
      </Card>
    </BookingWizardLayout>
  );
}

