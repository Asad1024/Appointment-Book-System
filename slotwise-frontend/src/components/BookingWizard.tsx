'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  bookingDetailsSchema,
  type BookingDetailsFormValues,
} from '@/lib/booking-details-schema';
import { AnimatePresence, motion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import { api, ensureCsrf, fetchMe } from '@/lib/api';
import {
  countryFromTimezone,
  normalizePhoneValue,
  toPhoneInputCountry,
} from '@/lib/phone';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert } from '@/components/ui/Alert';
import { AnimatedCheckmark } from '@/components/shared/AnimatedCheckmark';
import { BookingWizardLayout } from '@/components/booking/BookingWizardLayout';
import { BookingSummaryPanel } from '@/components/booking/BookingSummaryPanel';
import { AppointmentTimeSummary } from '@/components/booking/AppointmentTimeSummary';
import { DateTimePicker } from '@/components/booking/DateTimePicker';
import { WaitlistJoinPanel } from '@/components/booking/WaitlistJoinPanel';
import {
  WaitlistConfirmation,
  type WaitlistJoinedInfo,
} from '@/components/booking/WaitlistConfirmation';
import {
  resolveInitialCustomerTimezone,
  saveBookingTimezone,
} from '@/lib/booking-timezone';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/booking-dates';
import { OrgRequiredGate } from '@/components/booking/OrgRequiredGate';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { WizardStepNav } from '@/components/booking/WizardStepNav';
import {
  CustomerAssistantChat,
  type CustomerAssistantAction,
} from '@/components/ai/CustomerAssistantChat';
import { cn } from '@/lib/utils';
import { formatMoneyFromCents, normalizeBookingCurrency } from '@/lib/currency';
import { withTenantPath } from '@/lib/resolve-org-slug';
import { ReminderPreferencesEditor } from '@/components/shared/ReminderPreferencesEditor';
import {
  DEFAULT_REMINDER_OFFSETS_MINUTES,
  STAFF_ROLES,
  filterReminderOffsetsToAllowed,
  getApplicableReminderOffsets,
  pickReminderSelectionForAppointment,
} from '@pkg/shared-types';

type Location = {
  id: string;
  name: string;
  timezone: string;
  bookingWindowDays?: number;
  address?: string | null;
  reminderOffsetsMinutes?: number[];
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
type Slot = { startUtc: string; endUtc: string; status?: 'available' | 'booked' };

type IntegrationContext = {
  branding: { logoUrl?: string; primaryColor: string; currency?: string };
  locations: Location[];
  location: Location;
  services: Service[];
  product: string | null;
  reminderPresets?: { minutes: number; label: string }[];
};

export type BookingParams = {
  org?: string;
  product?: string;
  locationId?: string;
  source?: string;
  campaign?: string;
  returnUrl?: string;
  /** Partner tracking id (e.g. Leads Reach lead_123_deal_9) */
  ref?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  handoffKey?: string;
  /** Opened from external CRM — no logged-in prefill; minimal chrome */
  partner?: boolean;
  embed?: boolean;
};

const BASE_STEPS = ['Service', 'Staff', 'Date & time', 'Details', 'Confirm'];
const WIZARD_STORAGE_KEY = 'slotwise_booking_wizard';
const CHAT_BOOKING_HANDOFF_VERSION = 1;
const CHAT_BOOKING_HANDOFF_PREFIX = `slotwise-chat-booking-handoff:v${CHAT_BOOKING_HANDOFF_VERSION}`;
const BOOKING_PAYMENTS_ENABLED = false;

type DetailsFormValues = BookingDetailsFormValues;

type ChatBookingHandoff = {
  locationId: string;
  serviceId: string;
  providerId: string;
  selectedDate: string;
  startUtc: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  intakeAnswers?: Record<string, string>;
};

const stepMotion = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

const selectedChoiceClass =
  'border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/30 dark:border-brand-600 dark:bg-brand-950/35 dark:ring-brand-700/40';

function isChatBookingHandoff(value: unknown): value is ChatBookingHandoff {
  if (!value || typeof value !== 'object') return false;
  const handoff = value as Partial<Record<keyof ChatBookingHandoff, unknown>>;
  return (
    typeof handoff.locationId === 'string' &&
    typeof handoff.serviceId === 'string' &&
    typeof handoff.providerId === 'string' &&
    typeof handoff.selectedDate === 'string' &&
    typeof handoff.startUtc === 'string' &&
    typeof handoff.customerName === 'string' &&
    typeof handoff.customerEmail === 'string' &&
    typeof handoff.customerPhone === 'string'
  );
}

function loadChatBookingHandoff(key?: string): ChatBookingHandoff | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const storageKey = `${CHAT_BOOKING_HANDOFF_PREFIX}:${key}`;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isChatBookingHandoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isCurrentHostTenantScoped(orgSlug: string): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.startsWith(`${orgSlug.toLowerCase()}.`);
}

export function BookingWizard({ params }: { params: BookingParams }) {
  const org = params.org?.trim();
  if (!org) {
    return <OrgRequiredGate />;
  }
  const customerLoginHref = isCurrentHostTenantScoped(org)
    ? '/customer/login'
    : withTenantPath('/customer/login', org);
  const [step, setStep] = useState(0);
  const [ctx, setCtx] = useState<IntegrationContext | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [customerTimezone, setCustomerTimezone] = useState(() => resolveInitialCustomerTimezone());
  const phoneDefaultCountry = useMemo(
    () => countryFromTimezone(customerTimezone),
    [customerTimezone],
  );
  const [contextLoading, setContextLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slotUnavailable, setSlotUnavailable] = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState<WaitlistJoinedInfo | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, unknown> | null>(null);
  const [hasCustomerSession, setHasCustomerSession] = useState(false);
  const [chatHandoff] = useState<ChatBookingHandoff | null>(() => loadChatBookingHandoff(params.handoffKey));
  const [handoffPendingConfirm, setHandoffPendingConfirm] = useState(false);
  const [handoffHydrating, setHandoffHydrating] = useState(Boolean(chatHandoff));

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
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderSelectedMinutes, setReminderSelectedMinutes] = useState<number[]>([
    ...DEFAULT_REMINDER_OFFSETS_MINUTES,
  ]);

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
  const confirmStep = stepOffset + (hasIntakeStep ? 5 : 4);
  const intakeStep = stepOffset + 4;
  const selectedProvider = providers.find((p) => p.id === providerId);
  const locationReminderDefaults =
    selectedLocation?.reminderOffsetsMinutes ?? DEFAULT_REMINDER_OFFSETS_MINUTES;

  const applicableReminderOffsets = useMemo(() => {
    if (!startUtc) return [];
    return getApplicableReminderOffsets(locationReminderDefaults, startUtc);
  }, [startUtc, locationReminderDefaults]);

  const priceCents = selectedService?.priceCents ?? 0;
  const needsPayment = BOOKING_PAYMENTS_ENABLED && priceCents > 0;
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

  const initialPrefillPhone = params.customerPhone?.trim()
    ? normalizePhoneValue(params.customerPhone, countryFromTimezone(resolveInitialCustomerTimezone()))
    : '';

  const detailsForm = useForm<DetailsFormValues>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: {
      customerName: params.customerName?.trim() ?? '',
      customerEmail: params.customerEmail?.trim() ?? '',
      customerPhone: initialPrefillPhone,
    },
  });

  useEffect(() => {
    try {
      const raw = chatHandoff ? null : sessionStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, string | number>;
        if (saved.step != null) setStep(Number(saved.step));
        if (saved.serviceId) setServiceId(String(saved.serviceId));
        if (saved.providerId) setProviderId(String(saved.providerId));
        if (saved.selectedDate) setSelectedDate(String(saved.selectedDate));
        if (saved.startUtc) setStartUtc(String(saved.startUtc));
      }
    } catch {
      // Ignore invalid session state and continue with default timezone.
    }

    if (chatHandoff) {
      setLocationId(chatHandoff.locationId);
      setServiceId(chatHandoff.serviceId);
      setProviderId(chatHandoff.providerId);
      setSelectedDate(chatHandoff.selectedDate);
      setStartUtc(chatHandoff.startUtc);
      setCustomerName(chatHandoff.customerName);
      setCustomerEmail(chatHandoff.customerEmail);
      const handoffPhone = normalizePhoneValue(chatHandoff.customerPhone, phoneDefaultCountry);
      setCustomerPhone(handoffPhone);
      setIntakeAnswers(chatHandoff.intakeAnswers ?? {});
      detailsForm.reset({
        customerName: chatHandoff.customerName,
        customerEmail: chatHandoff.customerEmail,
        customerPhone: handoffPhone,
      });
      setHandoffPendingConfirm(true);
      if (params.handoffKey) {
        sessionStorage.removeItem(`${CHAT_BOOKING_HANDOFF_PREFIX}:${params.handoffKey}`);
      }
      sessionStorage.removeItem(WIZARD_STORAGE_KEY);
      return;
    }

    const prefillName = params.customerName?.trim() ?? '';
    const prefillEmail = params.customerEmail?.trim() ?? '';
    const prefillPhone = params.customerPhone?.trim()
      ? normalizePhoneValue(params.customerPhone, phoneDefaultCountry)
      : '';
    const hasUrlPrefill = Boolean(prefillName || prefillEmail || prefillPhone);

    if (hasUrlPrefill) {
      if (prefillName) setCustomerName(prefillName);
      if (prefillEmail) setCustomerEmail(prefillEmail);
      if (prefillPhone) setCustomerPhone(prefillPhone);
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
        const isStaffMember = STAFF_ROLES.includes(u.role as (typeof STAFF_ROLES)[number]);
        setHasCustomerSession(!isStaffMember);
        if (hasUrlPrefill) return;
        setCustomerEmail(u.email);
        setCustomerName(u.name);
        detailsForm.reset({
          customerName: u.name,
          customerEmail: u.email,
          customerPhone: '',
        });
        const prefs = u.reminderPreferences;
        if (prefs) {
          setRemindersEnabled(prefs.remindersEnabled);
          if (prefs.reminderOffsetsMinutes && prefs.reminderOffsetsMinutes.length > 0) {
            setReminderSelectedMinutes(prefs.reminderOffsetsMinutes);
          }
        }
      })
      .catch(() => {
        setHasCustomerSession(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (handoffHydrating) return;
    const max = steps.length - 1;
    setStep((s) => Math.min(Math.max(0, s), max));
  }, [steps.length, hasIntakeStep, serviceId, handoffHydrating]);

  useEffect(() => {
    if (handoffHydrating) return;
    sessionStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({
        step,
        serviceId,
        providerId,
        selectedDate,
        startUtc,
        locationId,
      }),
    );
  }, [step, serviceId, providerId, selectedDate, startUtc, locationId, handoffHydrating]);

  useEffect(() => {
    if (customerTimezone && customerTimezone !== 'UTC') {
      saveBookingTimezone(customerTimezone);
    }
  }, [customerTimezone]);

  const handleCustomerTimezoneChange = (tz: string) => {
    saveBookingTimezone(tz);
    setCustomerTimezone(tz);
  };

  useEffect(() => {
    if (!startUtc) return;
    setReminderSelectedMinutes((prev) =>
      pickReminderSelectionForAppointment(applicableReminderOffsets, prev),
    );
    setRemindersEnabled(applicableReminderOffsets.length > 0);
  }, [startUtc, applicableReminderOffsets]);

  useEffect(() => {
    const initialLocId = params.locationId ?? chatHandoff?.locationId;
    setContextLoading(true);
    loadContext(initialLocId)
      .then((c) => {
        setCtx(c);
        const multi = c.locations.length > 1;
        const pick =
          (initialLocId && c.locations.find((l) => l.id === initialLocId)?.id) ||
          (multi ? '' : c.location.id);
        if (pick) {
          setLocationId(pick);
          const loc = c.locations.find((l) => l.id === pick) ?? c.location;
          setTimezone(loc.timezone);
          applyLocationReminderDefaults(loc);
          if (!chatHandoff && !multi && c.services.length === 1) {
            setServiceId(c.services[0].id);
          }
          if (!chatHandoff && !multi) {
            setStep(stepOffset);
          }
        } else if (multi && !chatHandoff) {
          setLocationId('');
          setStep(0);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setContextLoading(false));
  }, [org, params.product, params.locationId, chatHandoff?.locationId, loadContext]);

  function applyLocationReminderDefaults(loc: Location) {
    const defaults = loc.reminderOffsetsMinutes ?? [...DEFAULT_REMINDER_OFFSETS_MINUTES];
    const applicable = startUtc
      ? getApplicableReminderOffsets(defaults, startUtc)
      : defaults;
    setReminderSelectedMinutes((prev) =>
      pickReminderSelectionForAppointment(applicable, prev.length > 0 ? prev : defaults),
    );
    setRemindersEnabled(applicable.length > 0);
  }

  function selectLocation(loc: Location) {
    setLocationId(loc.id);
    setTimezone(loc.timezone);
    setServiceId('');
    setProviderId('');
    setSelectedDate('');
    setStartUtc('');
    setError('');
    applyLocationReminderDefaults(loc);
    setContextLoading(true);
    loadContext(loc.id)
      .then((c) => {
        setCtx(c);
        if (c.services.length === 1) {
          setServiceId(c.services[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setContextLoading(false));
  }

  function selectService(serviceIdToSelect: string) {
    setServiceId(serviceIdToSelect);
    setProviders([]);
    setProvidersLoading(true);
    setIntakeAnswers({});
    setIntakeErrors({});
    setPaymentWaived(false);
    setProviderId('');
    setSelectedDate('');
    setStartUtc('');
  }

  function stepNameForAssistant() {
    if (hasLocationStep && step === 0) return 'location';
    if (step === stepOffset) return 'service';
    if (step === stepOffset + 1) return 'provider';
    if (step === stepOffset + 2) return 'dateTime';
    if (step === stepOffset + 3) return 'details';
    if (step === intakeStep && hasIntakeStep) return 'intake';
    if (step === confirmStep) return 'confirm';
    return 'service';
  }

  function goToAssistantStep(stepName: string) {
    if (stepName === 'confirm' && !hasCustomerDetails) {
      setError('Enter your name, email, and phone before reviewing your booking.');
      setStep(stepOffset + 3);
      return;
    }
    const target =
      stepName === 'location' && hasLocationStep
        ? 0
        : stepName === 'service'
          ? stepOffset
          : stepName === 'provider'
            ? stepOffset + 1
            : stepName === 'dateTime'
              ? stepOffset + 2
              : stepName === 'details'
                ? stepOffset + 3
                : stepName === 'intake' && hasIntakeStep
                  ? intakeStep
                  : stepName === 'confirm'
                    ? confirmStep
                    : step;
    setStep(Math.min(Math.max(target, 0), steps.length - 1));
  }

  function handleAssistantAction(action: CustomerAssistantAction) {
    switch (action.type) {
      case 'selectService':
        selectService(action.payload.serviceId);
        setStep(stepOffset + 1);
        break;
      case 'selectProvider':
        setProviderId(action.payload.providerId);
        setSelectedDate('');
        setStartUtc('');
        setStep(stepOffset + 2);
        break;
      case 'selectDate':
        setSelectedDate(action.payload.date);
        setStartUtc('');
        setStep(stepOffset + 2);
        break;
      case 'selectSlot':
        if (action.payload.serviceId !== serviceId) {
          selectService(action.payload.serviceId);
        }
        setProviderId(action.payload.providerId);
        setSelectedDate(action.payload.date);
        setStartUtc(action.payload.startUtc);
        setStep(stepOffset + 3);
        break;
      case 'goToStep':
        goToAssistantStep(action.payload.step);
        break;
      default:
        break;
    }
  }

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    if (!locationId || !serviceId) {
      setProviders([]);
      setProvidersLoading(false);
      return;
    }
    setProvidersLoading(true);
    const q = params.product ? `?serviceId=${serviceId}&product=${params.product}` : `?serviceId=${serviceId}`;
    api<Provider[]>(`/catalog/locations/${locationId}/providers${q}`)
      .then((p) => {
        setProviders(p);
        if (p.length === 1 && !providerId) setProviderId(p[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setProvidersLoading(false));
  }, [locationId, serviceId, params.product, providerId]);

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
      .catch((e) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [locationId, serviceId, providerId, selectedDate]);

  useEffect(() => {
    if (step === stepOffset + 3) {
      detailsForm.reset({ customerName, customerEmail, customerPhone });
    }
  }, [step, stepOffset, customerName, customerEmail, customerPhone, detailsForm]);

  const locationTz = selectedLocation?.timezone ?? timezone ?? 'UTC';
  const minBookDate = calendarDateInTimezone(locationTz);
  const maxBookDate = useMemo(() => {
    const days = selectedLocation?.bookingWindowDays ?? ctx?.location.bookingWindowDays ?? 60;
    return addCalendarDays(minBookDate, days, locationTz);
  }, [selectedLocation?.bookingWindowDays, ctx?.location.bookingWindowDays, minBookDate, locationTz]);

  const providerLabel =
    providerId === 'any' ? 'Any available' : selectedProvider?.name;
  const dateTimeLabel =
    startUtc && formatInTimeZone(new Date(startUtc), customerTimezone, 'PPpp');
  const hasCustomerDetails = Boolean(
    customerName.trim() && customerEmail.trim() && customerPhone.trim(),
  );

  useEffect(() => {
    if (!handoffPendingConfirm || !ctx || !selectedService || !startUtc || !hasCustomerDetails) return;
    if (providerId !== 'any' && !selectedProvider) return;
    setStep(confirmStep);
    window.requestAnimationFrame(() => setHandoffHydrating(false));
    setHandoffPendingConfirm(false);
  }, [
    confirmStep,
    ctx,
    handoffPendingConfirm,
    hasCustomerDetails,
    providerId,
    selectedProvider,
    selectedService,
    startUtc,
  ]);

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
    const formValues = detailsForm.getValues();
    const name = (formValues.customerName ?? customerName).trim();
    const email = (formValues.customerEmail ?? customerEmail).trim();

    if (!name || !email) {
      setError('Enter your name and email above, then join the waitlist.');
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
          providerId: providerId === 'any' ? undefined : providerId,
          preferredDate: selectedDate,
          ...(startUtc ? { preferredStartUtc: startUtc } : {}),
          customerEmail: email,
          customerName: name,
          customerPhone: (formValues.customerPhone ?? customerPhone).trim() || undefined,
        }),
      });
      setSlotUnavailable(false);
      const tz = selectedLocation?.timezone ?? timezone;
      setWaitlistJoined({
        preferredDate: selectedDate,
        preferredTimeLabel: startUtc
          ? formatInTimeZone(new Date(startUtc), tz, 'h:mm a')
          : 'Any time',
        serviceName: selectedService?.name ?? 'your service',
        customerEmail: email,
        customerPhone: (formValues.customerPhone ?? customerPhone).trim() || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Waitlist failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setWaitlistJoining(false);
    }
  }

  const availableSlotCount = slots.filter((s) => (s.status ?? 'available') === 'available').length;
  const dayFullyBooked = Boolean(selectedDate) && !slotsLoading && availableSlotCount === 0;

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
          metadata: JSON.stringify({
            org,
            source: params.source,
            campaign: params.campaign,
            ref: params.ref,
          }),
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
      if (!hasCustomerDetails) {
        setError('Enter your name, email, and phone before confirming.');
        setStep(stepOffset + 3);
        return;
      }
      if (!startUtc) {
        setError('Please select a time slot.');
        setStep(stepOffset + 2);
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
        setStep(stepOffset + 2);
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
      if (remindersEnabled && allowedReminders.length > 0 && effectiveReminderMinutes.length === 0) {
        setError('Select at least one reminder time, or turn reminders off.');
        setStep(stepOffset + 3);
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
          metadata: JSON.stringify({
            org,
            source: params.source,
            campaign: params.campaign,
            ref: params.ref,
          }),
          intakeResponses: intakePayload(),
          remindersEnabled:
            allowedReminders.length > 0 ? remindersEnabled && effectiveReminderMinutes.length > 0 : false,
          reminderOffsetsMinutes: effectiveReminderMinutes,
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

  if (waitlistJoined && !params.returnUrl) {
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
            <Link href={`/manage/${confirmed.manageToken as string}?partner=1`}>
              <Button style={{ backgroundColor: primaryColor }}>Manage appointment</Button>
            </Link>
            {!params.embed && hasCustomerSession && (
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

  if (handoffHydrating) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardBody className="py-12">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
            aria-hidden
          />
          <h2 className="mt-5 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            Preparing your final review
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            We are filling your booking details before showing the confirmation step.
          </p>
        </CardBody>
      </Card>
    );
  }

  const header =
    params.source && !params.partner ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Referred from <span className="font-medium text-slate-700 dark:text-slate-200">{params.source}</span>
      </p>
    ) : undefined;

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
                  {contextLoading && (
                    <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                      Loading services...
                    </div>
                  )}
                  {!contextLoading && services.length === 0 && (
                    <p className="mt-6 text-slate-500 dark:text-slate-400">No services available for this product.</p>
                  )}
                  <ul className="mt-6 space-y-3">
                    {services.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            selectService(s.id);
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
                            {BOOKING_PAYMENTS_ENABLED && s.priceCents && s.priceCents > 0
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
                    nextDisabled={!serviceId || providersLoading}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 1 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Choose your expert</h2>
                  {providersLoading && (
                    <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                      Loading staff...
                    </div>
                  )}
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
                        Any available staff
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
                  {!providersLoading && providers.length === 0 && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      No individual staff are assigned yet. You can still choose any available staff.
                    </p>
                  )}
                  <WizardStepNav
                    onBack={goBack}
                    onNext={goNext}
                    nextDisabled={!providerId || providersLoading}
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
                      onCustomerTimezoneChange={handleCustomerTimezoneChange}
                      selectedDate={selectedDate}
                      onDateChange={handleDateChange}
                      startUtc={startUtc}
                      onSlotSelect={setStartUtc}
                      slots={slots}
                      loading={slotsLoading}
                      minDate={minBookDate}
                      maxDate={maxBookDate}
                      accentColor={primaryColor}
                    />
                    {dayFullyBooked && (
                      <WaitlistJoinPanel
                        selectedDate={selectedDate}
                        hasPreferredTime={Boolean(startUtc)}
                        variant="guide"
                      />
                    )}
                  </div>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={goNext}
                    nextDisabled={!startUtc && !dayFullyBooked}
                    nextLabel={dayFullyBooked ? 'Continue — join waitlist' : 'Next'}
                    primaryColor={primaryColor}
                  />
                </div>
              )}

              {step === stepOffset + 3 && (
                <div>
                  <h2 className="font-display text-lg font-semibold">Your details</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {params.partner ? (
                      'Your details were loaded from your CRM. You can edit them if needed.'
                    ) : (
                      <>
                        <Link href={customerLoginHref} className="font-medium text-brand-600 hover:underline">
                          Sign in
                        </Link>{' '}
                        to pre-fill, or continue as guest.
                      </>
                    )}
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
                      <Label htmlFor="phone">
                        {dayFullyBooked
                          ? 'Phone (for WhatsApp waitlist confirmation)'
                          : 'Phone (required for WhatsApp updates)'}
                      </Label>
                      <Controller
                        name="customerPhone"
                        control={detailsForm.control}
                        render={({ field }) => (
                          <PhoneInput
                            id="phone"
                            required={!dayFullyBooked}
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
                      {detailsForm.formState.errors.customerPhone && (
                        <p className="mt-1 text-sm text-red-600">
                          {detailsForm.formState.errors.customerPhone.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        {dayFullyBooked
                          ? 'We send waitlist confirmation by email and WhatsApp when a valid phone is provided.'
                          : 'We send booking confirmations by email and WhatsApp.'}
                      </p>
                    </div>
                    {dayFullyBooked && (
                      <WaitlistJoinPanel
                        selectedDate={selectedDate}
                        hasPreferredTime={Boolean(startUtc)}
                        variant="action"
                        loading={waitlistJoining}
                        onJoin={() => void joinWaitlist()}
                      />
                    )}
                    {!dayFullyBooked && !startUtc ? (
                      <p className="text-sm text-text-secondary">
                        Select a date and time first to see reminder options.
                      </p>
                    ) : !dayFullyBooked && applicableReminderOffsets.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        This appointment is too soon for advance reminders. You will still get an
                        immediate confirmation by email and WhatsApp.
                      </p>
                    ) : !dayFullyBooked ? (
                      <ReminderPreferencesEditor
                        enabled={remindersEnabled}
                        selectedMinutes={filterReminderOffsetsToAllowed(
                          reminderSelectedMinutes,
                          applicableReminderOffsets,
                        )}
                        allowedMinutes={applicableReminderOffsets}
                        onEnabledChange={setRemindersEnabled}
                        onSelectedChange={setReminderSelectedMinutes}
                        description="Tap each time you want a reminder. Options depend on how soon your appointment starts."
                      />
                    ) : null}
                  </form>
                  <WizardStepNav
                    onBack={goBack}
                    onNext={
                      dayFullyBooked
                        ? undefined
                        : () => void detailsForm.handleSubmit(onDetailsSubmit)()
                    }
                    showNext={!dayFullyBooked}
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
                  {!hasCustomerDetails && (
                    <Alert variant="info" className="mt-4">
                      Your time is selected, but your contact details are missing. Go back to
                      details, enter your name, email, and phone, then return to review.
                    </Alert>
                  )}
                  {startUtc && (
                    <AppointmentTimeSummary
                      className="mt-6"
                      startUtc={startUtc}
                      endUtc={
                        selectedService?.durationMinutes
                          ? new Date(
                              new Date(startUtc).getTime() +
                                selectedService.durationMinutes * 60_000,
                            ).toISOString()
                          : undefined
                      }
                      customerTimezone={customerTimezone}
                      officeTimezone={timezone}
                    />
                  )}
                  <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
                    {[
                      ...(hasLocationStep ? [['Location', selectedLocation?.name] as const] : []),
                      ['Service', selectedService?.name],
                      ['Expert', providerId === 'any' ? 'Any available' : selectedProvider?.name],
                      ['Name', customerName || 'Missing'],
                      ['Email', customerEmail || 'Missing'],
                      ['Phone', customerPhone || 'Missing'],
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
                    disabled={loading || !hasCustomerDetails}
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
      <CustomerAssistantChat
        primaryColor={primaryColor}
        context={{
          org,
          page: 'booking',
          step: stepNameForAssistant(),
          state: {
            locationId: locationId || undefined,
            serviceId: serviceId || undefined,
            providerId: providerId || undefined,
            selectedDate: selectedDate || undefined,
            startUtc: startUtc || undefined,
            customerTimezone,
            hasCustomerDetails,
          },
        }}
        onAction={handleAssistantAction}
      />
    </BookingWizardLayout>
  );
}
