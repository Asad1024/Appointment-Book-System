'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { Bot, Mail, MessageCircle, Mic, MicOff, Phone, RotateCcw, Send, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ensureCsrf } from '@/lib/api';
import { bookingDetailsSchema } from '@/lib/booking-details-schema';
import {
  buildIntakePayload,
  parseCheckboxSelection,
  validateIntakeFields,
  type BookingIntakeField,
} from '@/lib/booking-intake';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { cn } from '@/lib/utils';
import { useAuthUser } from '@/lib/useAuthUser';
import { withTenantPath } from '@/lib/resolve-org-slug';

export type CustomerAssistantAction =
  | { type: 'selectService'; label: string; payload: { serviceId: string } }
  | { type: 'selectProvider'; label: string; payload: { providerId: string } }
  | { type: 'selectDate'; label: string; payload: { date: string } }
  | {
      type: 'selectSlot';
      label: string;
      payload: { serviceId: string; providerId: string; date: string; startUtc: string };
    }
  | { type: 'goToStep'; label: string; payload: { step: string } }
  | { type: 'openUrl'; label: string; payload: { href: string } }
  | { type: 'startChatBooking'; label: string; payload: { locationId?: string; serviceId?: string } }
  | { type: 'collectCustomerDetails'; label: string; payload: Record<string, never> }
  | { type: 'collectIntake'; label: string; payload: { serviceId: string } }
  | { type: 'confirmBooking'; label: string; payload: Record<string, never> }
  | { type: 'resumeChatBooking'; label: string; payload: Record<string, never> }
  | { type: 'editChatBooking'; label: string; payload: { target: 'service' | 'provider' | 'time' | 'details' } }
  | { type: 'chooseChatService'; label: string; payload: { serviceId: string } }
  | { type: 'chooseChatProvider'; label: string; payload: { providerId: string } }
  | {
      type: 'chooseChatSlot';
      label: string;
      payload: { serviceId: string; providerId: string; date: string; startUtc: string; endUtc: string };
    }
  | { type: 'answerIntake'; label: string; payload: { fieldId: string; value: string } };

export type CustomerAssistantContext = {
  org: string;
  page: 'landing' | 'booking' | 'filled-booking' | 'account';
  step?: string;
  state?: {
    locationId?: string;
    serviceId?: string;
    providerId?: string;
    selectedDate?: string;
    startUtc?: string;
    customerTimezone?: string;
    hasCustomerDetails?: boolean;
  };
  accountContext?: Record<string, unknown>;
};

type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: CustomerAssistantAction[];
  quickReplies?: string[];
};

type AssistantResponse = {
  message: string;
  actions?: CustomerAssistantAction[];
  quickReplies?: string[];
  warning?: string;
};

type AssistantHistoryResponse = {
  messages?: Pick<AssistantMessage, 'role' | 'content'>[];
};

type ChatBookingPhase = 'idle' | 'service' | 'provider' | 'slot' | 'details' | 'intake' | 'review' | 'booked';

type ChatLocation = {
  id: string;
  name: string;
  timezone: string;
  bookingWindowDays?: number;
};

type ChatService = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents?: number | null;
  intakeFields?: BookingIntakeField[];
};

type ChatProvider = {
  id: string;
  name: string;
};

type ChatSlot = {
  startUtc: string;
  endUtc: string;
  status?: 'available' | 'booked';
  providerId?: string | null;
};

type ChatBookingContext = {
  organization: { name: string; slug: string };
  location: ChatLocation;
  locations: ChatLocation[];
  services: ChatService[];
};

type ChatBookingDetails = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

type ChatBookingDraft = {
  phase: ChatBookingPhase;
  contextData?: ChatBookingContext;
  locationId?: string;
  serviceId?: string;
  providerId?: string;
  selectedDate?: string;
  timePreference?: string | null;
  slot?: ChatSlot;
  providers: ChatProvider[];
  details: ChatBookingDetails;
  intakeAnswers: Record<string, string>;
  intakeIndex: number;
  booked?: { id?: string; manageToken?: string; manageUrl?: string };
};

type AssistantSelectionState = NonNullable<CustomerAssistantContext['state']>;

type BookingResult = {
  id?: string;
  status?: string;
  manageToken?: string;
  manageUrl?: string;
  startUtc?: string;
  endUtc?: string;
};

type BookingWizardHandoff = {
  locationId: string;
  serviceId: string;
  providerId: string;
  selectedDate: string;
  startUtc: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  intakeAnswers: Record<string, string>;
};

type Props = {
  context: CustomerAssistantContext;
  primaryColor?: string;
  onAction?: (action: CustomerAssistantAction) => void;
};

const ASSISTANT_NAME = 'Slotwise Concierge';
const ASSISTANT_STORAGE_VERSION = 1;
const CHAT_BOOKING_DRAFT_VERSION = 1;
const CHAT_BOOKING_HANDOFF_VERSION = 1;
const CHAT_BOOKING_SOURCE = 'chat_assistant';
const CHAT_BOOKING_HANDOFF_PREFIX = `slotwise-chat-booking-handoff:v${CHAT_BOOKING_HANDOFF_VERSION}`;
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function emptyDraft(): ChatBookingDraft {
  return {
    phase: 'idle',
    providers: [],
    details: { customerName: '', customerEmail: '', customerPhone: '' },
    intakeAnswers: {},
    intakeIndex: 0,
  };
}

function bookingPageHref(org: string, handoffKey?: string) {
  const query = handoffKey ? `?handoff=${encodeURIComponent(handoffKey)}` : '';
  return withTenantPath(`/book${query}`, org);
}

function todayInTimezone(timezone: string) {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

function addDays(date: string, days: number, timezone: string) {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return formatInTimeZone(parsed, timezone, 'yyyy-MM-dd');
}

function dateFromText(raw: string, timezone: string) {
  const lower = raw.toLowerCase();
  const today = todayInTimezone(timezone);
  if (lower.includes('tomorrow')) return addDays(today, 1, timezone);
  if (lower.includes('today')) return today;
  if (lower.includes('weekend')) {
    const now = new Date(`${today}T12:00:00`);
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    return addDays(today, daysUntilSaturday, timezone);
  }
  const iso = lower.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];

  const weekday = Object.entries(WEEKDAY_INDEX).find(([label]) =>
    new RegExp(`\\b${label}\\b`).test(lower),
  );
  if (!weekday) return today;

  const [, targetDay] = weekday;
  const now = new Date(`${today}T12:00:00`);
  let days = (targetDay - now.getDay() + 7) % 7;
  if (days === 0 || lower.includes('next ')) days += 7;
  return addDays(today, days, timezone);
}

function timePreferenceFromText(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (lower.includes('morning')) return 'morning';
  if (lower.includes('afternoon') || lower.includes('lunch')) return 'afternoon';
  if (lower.includes('evening')) return 'evening';
  if (lower.includes('before noon')) return 'morning';
  if (
    lower.includes('earliest') ||
    lower.includes('earlier') ||
    lower.includes('soonest') ||
    lower.includes('first available')
  ) {
    return 'earliest';
  }
  const after = lower.match(/\bafter\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/);
  const before = lower.match(/\bbefore\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/);
  if (after && before) return `${after[0]} ${before[0]}`;
  if (after) return after[0];
  if (before) return before[0];
  const exact = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  return exact?.[0] ?? null;
}

function slotMatchesPreference(slot: ChatSlot, timezone: string, preference?: string | null) {
  if (!preference || preference === 'earliest') return true;
  const hour = Number(formatInTimeZone(new Date(slot.startUtc), timezone, 'H'));
  const normalized = preference.toLowerCase();
  if (normalized.includes('morning')) return hour >= 6 && hour < 12;
  if (normalized.includes('afternoon')) return hour >= 12 && hour < 17;
  if (normalized.includes('evening')) return hour >= 17 && hour < 21;
  const after = normalized.match(/after\s+(\d{1,2})/);
  const before = normalized.match(/before\s+(\d{1,2})/);
  if (after && before) {
    const afterThreshold = timeThreshold(Number(after[1]), normalized);
    const beforeThreshold = timeThreshold(Number(before[1]), normalized);
    return hour >= afterThreshold && hour < beforeThreshold;
  }
  if (after) {
    const threshold = timeThreshold(Number(after[1]), normalized);
    return hour >= threshold;
  }
  if (before) {
    const threshold = timeThreshold(Number(before[1]), normalized);
    return hour < threshold;
  }
  const exact = normalized.match(/\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b/);
  if (exact) {
    const raw = Number(exact[1]);
    const threshold = exact[2] === 'pm' && raw < 12 ? raw + 12 : raw;
    return hour >= threshold;
  }
  return true;
}

function timeThreshold(raw: number, text: string) {
  if (text.includes('pm') && raw < 12) return raw + 12;
  if (!text.includes('am') && !text.includes('pm') && raw >= 1 && raw <= 7) return raw + 12;
  return raw;
}

function availableSlots(slots: ChatSlot[]) {
  return slots.filter((slot) => (slot.status ?? 'available') === 'available');
}

function parseDetailsInput(raw: string): Partial<ChatBookingDetails> {
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = raw.match(/\+?[\d][\d\s\-()]{7,19}/)?.[0]?.trim() ?? '';
  const cleanedName = raw
    .replace(email, '')
    .replace(phone, '')
    .replace(/\b(name|email|phone|mobile|contact)\b\s*[:=-]?/gi, '')
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 2 && /[a-z]/i.test(part));
  return {
    customerName: cleanedName ?? '',
    customerEmail: email,
    customerPhone: phone,
  };
}

function optionValues(field: BookingIntakeField) {
  return Array.isArray(field.options) ? field.options.filter((option) => option.trim()) : [];
}

function displayIntakeAnswer(field: BookingIntakeField, value: string) {
  if (field.type === 'checkbox') {
    return parseCheckboxSelection(value).join(', ');
  }
  return value;
}

function isDraftLike(value: unknown): value is ChatBookingDraft {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'phase' in value &&
      typeof (value as { phase?: unknown }).phase === 'string' &&
      'details' in value &&
      typeof (value as { details?: unknown }).details === 'object',
  );
}

function isBookWithMeText(value: string) {
  const lower = value.toLowerCase();
  return lower.includes('book with me') || (/\bbook\b/.test(lower) && /appoint|appint|apoint/.test(lower));
}

function isShowServicesText(value: string) {
  const lower = value.toLowerCase();
  return lower.includes('show services') || lower.includes('available services') || lower === 'services';
}

function staffLanguageText(value: string) {
  return value
    .replace(/\bproviders\b/gi, 'staff')
    .replace(/\bprovider\b/gi, 'staff member');
}

function staffLanguageAction(action: CustomerAssistantAction): CustomerAssistantAction {
  return {
    ...action,
    label: staffLanguageText(action.label),
  } as CustomerAssistantAction;
}

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function defaultGreeting(page: CustomerAssistantContext['page'], name?: string | null) {
  const prefix = name?.trim() ? `Hi, ${name.trim()}.` : 'Hi.';
  if (page === 'account') {
    return `${prefix} I can help you understand your appointments, waitlist, and where to book or manage a visit.`;
  }
  if (page === 'landing') {
    return `${prefix} I can help you find services, understand booking options, and start an appointment with this business.`;
  }
  return `${prefix} I can help you choose a service, find real available slots, and explain what to do on each booking step.`;
}

function historyMessages(messages: AssistantMessage[]) {
  return messages.slice(-30).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function hydrateHistoryMessages(messages: AssistantHistoryResponse['messages']): AssistantMessage[] {
  return (messages ?? [])
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim(),
    )
    .map((message) => ({
      id: crypto.randomUUID(),
      role: message.role,
      content: message.role === 'assistant' ? staffLanguageText(message.content) : message.content,
    }));
}

export function CustomerAssistantChat({ context, primaryColor = '#4f46e5', onAction }: Props) {
  const { user, loading: authLoading } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [introTyping, setIntroTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<ChatBookingDraft>(() => emptyDraft());
  const [detailsForm, setDetailsForm] = useState<ChatBookingDetails>(() => emptyDraft().details);
  const [detailsError, setDetailsError] = useState('');
  const [assistantSelection, setAssistantSelection] = useState<AssistantSelectionState>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const detailsNameRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTextRef = useRef('');
  const actionBusyRef = useRef(false);

  const legacyStorageKey = useMemo(
    () => `slotwise-assistant:v${ASSISTANT_STORAGE_VERSION}:${context.org}:${context.page}`,
    [context.org, context.page],
  );
  const draftStorageKey = useMemo(
    () => `slotwise-chat-booking-draft:v${CHAT_BOOKING_DRAFT_VERSION}:${context.org}:${context.page}`,
    [context.org, context.page],
  );
  const historyQuery = useMemo(
    () =>
      new URLSearchParams({
        org: context.org,
        page: context.page,
      }).toString(),
    [context.org, context.page],
  );

  const compactMessages = useMemo(
    () => messages.slice(-8).map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );
  const assistantContext = useMemo<CustomerAssistantContext>(
    () => ({
      ...context,
      state: {
        ...(context.state ?? {}),
        ...assistantSelection,
      },
    }),
    [assistantSelection, context],
  );

  useEffect(() => {
    setDraftLoaded(false);
    if (typeof window === 'undefined') {
      setBookingDraft(emptyDraft());
      setDraftLoaded(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      setBookingDraft(isDraftLike(parsed) && parsed.phase !== 'booked' ? parsed : emptyDraft());
    } catch {
      setBookingDraft(emptyDraft());
    } finally {
      setDraftLoaded(true);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftLoaded || typeof window === 'undefined') return;
    if (bookingDraft.phase === 'idle' || bookingDraft.phase === 'booked') {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(bookingDraft));
  }, [bookingDraft, draftLoaded, draftStorageKey]);

  useEffect(() => {
    let cancelled = false;
    setMessagesLoaded(false);
    if (authLoading) return;
    if (typeof window === 'undefined') {
      setMessages([]);
      setMessagesLoaded(true);
      return;
    }
    window.localStorage.removeItem(legacyStorageKey);
    if (!user) {
      setMessages([]);
      setMessagesLoaded(true);
      return;
    }

    api<AssistantHistoryResponse>(`/ai/customer-assistant/history?${historyQuery}`)
      .then((history) => {
        if (cancelled) return;
        setMessages(hydrateHistoryMessages(history.messages));
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, historyQuery, legacyStorageKey, user?.id]);

  useEffect(() => {
    if (!messagesLoaded || !user || messages.length === 0) return;
    const timer = window.setTimeout(() => {
      void api('/ai/customer-assistant/history', {
        method: 'PUT',
        body: JSON.stringify({
          org: context.org,
          page: context.page,
          messages: historyMessages(messages),
        }),
      }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [context.org, context.page, messages, messagesLoaded, user?.id]);

  useEffect(() => {
    if (!open || !messagesLoaded || !draftLoaded || messages.length > 0) return;
    setIntroTyping(true);
    const timer = window.setTimeout(() => {
      const hasDraft = bookingDraft.phase !== 'idle' && bookingDraft.phase !== 'booked';
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: hasDraft
            ? 'Welcome back. I saved your booking draft, so you can continue where you left off.'
            : defaultGreeting(context.page, user?.name),
          actions: hasDraft
            ? [
                { type: 'resumeChatBooking', label: 'Continue draft', payload: {} },
                { type: 'openUrl', label: 'Use booking page', payload: { href: bookingPageHref(context.org) } },
              ]
            : [],
          quickReplies:
            hasDraft
              ? ['What is next?']
              : context.page === 'account'
              ? ['Book with me', 'Where are my upcoming appointments?', 'How do I reschedule?']
              : ['Book with me', 'Show services'],
        },
      ]);
      setIntroTyping(false);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [bookingDraft.phase, context.org, context.page, draftLoaded, messages.length, messagesLoaded, open, user?.name]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bookingDraft.phase, messages, introTyping, loading, open]);

  useEffect(() => {
    if (bookingDraft.phase !== 'details') return;
    setDetailsForm(bookingDraft.details);
    setDetailsError('');
    const timer = window.setTimeout(() => detailsNameRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [bookingDraft.details, bookingDraft.phase]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function suppressRedundantActions(actions: CustomerAssistantAction[]) {
    return actions.filter((action) => {
      if (action.type === 'selectService') {
        return action.payload.serviceId !== (assistantContext.state?.serviceId ?? '');
      }
      if (action.type === 'chooseChatService') {
        return action.payload.serviceId !== (bookingDraft.serviceId ?? '');
      }
      if (action.type === 'selectProvider') {
        return action.payload.providerId !== (assistantContext.state?.providerId ?? '');
      }
      if (action.type === 'chooseChatProvider') {
        return action.payload.providerId !== (bookingDraft.providerId ?? '');
      }
      if (action.type === 'selectDate') {
        return action.payload.date !== (assistantContext.state?.selectedDate ?? '');
      }
      if (action.type === 'selectSlot') {
        return action.payload.startUtc !== (assistantContext.state?.startUtc ?? '');
      }
      if (action.type === 'chooseChatSlot') {
        return action.payload.startUtc !== bookingDraft.slot?.startUtc;
      }
      return true;
    });
  }

  function cleanQuickReplies(actions: CustomerAssistantAction[], replies: string[]) {
    const hasServiceAction = actions.some((action) => ['selectService', 'chooseChatService'].includes(action.type));
    const hasProviderAction = actions.some((action) => ['selectProvider', 'chooseChatProvider'].includes(action.type));
    const hasSlotAction = actions.some((action) => ['selectSlot', 'chooseChatSlot'].includes(action.type));
    const hasBookAction = actions.some((action) => action.type === 'startChatBooking');

    return replies
      .filter((reply, index, all) => all.findIndex((item) => item.toLowerCase() === reply.toLowerCase()) === index)
      .filter((reply) => {
        const lower = reply.toLowerCase();
        if (hasBookAction && lower.includes('book with me')) return false;
        if (hasServiceAction && (lower.includes('service') || lower.includes('slot'))) return false;
        if (hasProviderAction && (lower.includes('provider') || lower.includes('staff'))) return false;
        if (hasSlotAction && lower.includes('slot')) return false;
        return !actions.some((action) => action.label.toLowerCase() === lower);
      })
      .slice(0, 2);
  }

  function addAssistantMessage(
    content: string,
    actions: CustomerAssistantAction[] = [],
    quickReplies: string[] = [],
  ) {
    const cleanActions = suppressRedundantActions(actions).map(staffLanguageAction);
    const cleanContent = staffLanguageText(content);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.content === cleanContent) return prev;
      return [
        ...prev,
        {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanContent,
        actions: cleanActions,
        quickReplies: cleanQuickReplies(cleanActions, quickReplies.map(staffLanguageText)),
      },
      ];
    });
  }

  function selectedService(draft = bookingDraft) {
    return draft.contextData?.services.find((service) => service.id === draft.serviceId) ?? null;
  }

  function selectedProvider(draft = bookingDraft) {
    if (draft.providerId === 'any') return { id: 'any', name: 'Any available staff' };
    return draft.providers.find((provider) => provider.id === draft.providerId) ?? null;
  }

  function selectedLocation(draft = bookingDraft) {
    return draft.contextData?.locations.find((location) => location.id === draft.locationId)
      ?? draft.contextData?.location
      ?? null;
  }

  function findServiceByText(text: string, services: ChatService[]) {
    const normalized = text.toLowerCase();
    return (
      services.find((service) => service.name.toLowerCase() === normalized) ??
      services.find((service) => normalized.includes(service.name.toLowerCase())) ??
      services.find((service) =>
        service.name
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 2)
          .some((word) => normalized.includes(word)),
      ) ??
      null
    );
  }

  function findProviderByText(text: string, providers: ChatProvider[]) {
    const normalized = text.toLowerCase();
    if (normalized.includes('any') || normalized.includes('available provider') || normalized.includes('available staff')) {
      return { id: 'any', name: 'Any available staff' };
    }
    return (
      providers.find((provider) => provider.name.toLowerCase() === normalized) ??
      providers.find((provider) => normalized.includes(provider.name.toLowerCase())) ??
      null
    );
  }

  async function loadBookingContext(locationId?: string) {
    const query = new URLSearchParams({ org: context.org });
    if (locationId) query.set('locationId', locationId);
    return api<ChatBookingContext>(`/integration/context?${query.toString()}`);
  }

  async function loadProviders(locationId: string, serviceId: string) {
    return api<ChatProvider[]>(
      `/catalog/locations/${locationId}/providers?serviceId=${encodeURIComponent(serviceId)}`,
    );
  }

  async function loadSlots(
    locationId: string,
    serviceId: string,
    providerId: string,
    date: string,
  ) {
    const query = new URLSearchParams({
      locationId,
      serviceId,
      providerId,
      fromDate: date,
      toDate: date,
    });
    const result = await api<{ slots: ChatSlot[] }>(`/availability/slots?${query.toString()}`);
    return availableSlots(result.slots);
  }

  function serviceActions(services: ChatService[]): CustomerAssistantAction[] {
    return services.slice(0, 5).map((service) => ({
      type: 'chooseChatService',
      label: service.name,
      payload: { serviceId: service.id },
    }));
  }

  function providerActions(providers: ChatProvider[]): CustomerAssistantAction[] {
    return [
      ...providers.slice(0, 4).map((provider) => ({
        type: 'chooseChatProvider' as const,
        label: provider.name,
        payload: { providerId: provider.id },
      })),
      { type: 'chooseChatProvider' as const, label: 'Any available staff', payload: { providerId: 'any' } },
    ];
  }

  function slotActions(
    draft: ChatBookingDraft,
    slots: ChatSlot[],
    date: string,
  ): CustomerAssistantAction[] {
    const timezone = selectedLocation(draft)?.timezone ?? 'UTC';
    return slots.slice(0, 5).map((slot) => ({
      type: 'chooseChatSlot',
      label: formatInTimeZone(new Date(slot.startUtc), timezone, 'EEE h:mm a'),
      payload: {
        serviceId: draft.serviceId ?? '',
        providerId: slot.providerId ?? draft.providerId ?? 'any',
        date,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
      },
    }));
  }

  async function startChatBooking(serviceId?: string, locationId?: string) {
    setLoading(true);
    try {
      const contextData = await loadBookingContext(locationId ?? context.state?.locationId);
      const nextDraft: ChatBookingDraft = {
        ...emptyDraft(),
        phase: 'service',
        contextData,
        locationId: contextData.location.id,
        serviceId,
        details: {
          customerName: user?.name ?? '',
          customerEmail: user?.email ?? '',
          customerPhone: '',
        },
      };
      setBookingDraft(nextDraft);

      if (serviceId && contextData.services.some((service) => service.id === serviceId)) {
        await chooseChatService(serviceId, nextDraft);
        return;
      }

      addAssistantMessage(
        'Great. Do you want to book through chat or open the full booking page? Choose a service to continue here.',
        [
          ...serviceActions(contextData.services),
          { type: 'openUrl', label: 'Go to booking page', payload: { href: bookingPageHref(context.org) } },
        ],
        ['Show free slots'],
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start chat booking');
      addAssistantMessage('I could not load booking options. Please open the booking page instead.', [
        { type: 'openUrl', label: 'Go to booking page', payload: { href: bookingPageHref(context.org) } },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function chooseChatService(serviceId: string, baseDraft = bookingDraft) {
    const contextData = baseDraft.contextData;
    const locationId = baseDraft.locationId;
    if (!contextData || !locationId) return;
    const service = contextData.services.find((item) => item.id === serviceId);
    if (!service) return;

    setLoading(true);
    try {
      const providers = await loadProviders(locationId, serviceId);
      const nextDraft = {
        ...baseDraft,
        phase: 'provider' as const,
        serviceId,
        providerId: undefined,
        slot: undefined,
        providers,
      };
      setBookingDraft(nextDraft);
      const staffIntro =
        providers.length > 0
          ? `Available staff for this service: ${providers.map((provider) => provider.name).join(', ')}.`
          : 'I did not find assigned staff for this service, but I can still check any available staff.';
      addAssistantMessage(
        `${service.name} selected. ${staffIntro} Which staff member do you prefer?`,
        providerActions(providers),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load staff');
    } finally {
      setLoading(false);
    }
  }

  async function suggestSlots(
    baseDraft = bookingDraft,
    startDate?: string,
    preference = baseDraft.timePreference,
  ) {
    const location = selectedLocation(baseDraft);
    if (!location || !baseDraft.serviceId || !baseDraft.providerId) return;
    setLoading(true);
    try {
      const firstDate = startDate ?? todayInTimezone(location.timezone);
      const days = Math.min(location.bookingWindowDays ?? 14, 14);
      for (let offset = 0; offset < days; offset += 1) {
        const date = addDays(firstDate, offset, location.timezone);
        const slots = (await loadSlots(
          location.id,
          baseDraft.serviceId,
          baseDraft.providerId,
          date,
        )).filter((slot) => slotMatchesPreference(slot, location.timezone, preference));
        if (slots.length > 0) {
          const nextDraft = {
            ...baseDraft,
            phase: 'slot' as const,
            selectedDate: date,
            timePreference: preference,
            slot: undefined,
          };
          setBookingDraft(nextDraft);
          addAssistantMessage(
            offset === 0
              ? preference && preference !== 'earliest'
                ? `Here are the free slots matching "${preference}". Choose one and I will collect your details next.`
                : 'Here are the free slots I found. Choose one and I will collect your details next.'
              : `That day has no matching free slots. The next available options I found are on ${date}.`,
            slotActions(nextDraft, slots, date),
            ['Try tomorrow'],
          );
          return;
        }
      }
      setBookingDraft({ ...baseDraft, phase: 'slot' });
      addAssistantMessage(
        'I could not find a free slot in the next booking window. Try another staff member or use the full booking page.',
        [
          ...providerActions(baseDraft.providers).filter(
            (action) => action.type !== 'chooseChatProvider' || action.payload.providerId !== baseDraft.providerId,
          ),
          { type: 'openUrl', label: 'Go to booking page', payload: { href: bookingPageHref(context.org) } },
        ],
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load slots');
    } finally {
      setLoading(false);
    }
  }

  async function chooseChatProvider(providerId: string) {
    const nextDraft = {
      ...bookingDraft,
      phase: 'slot' as const,
      providerId,
      slot: undefined,
    };
    setBookingDraft(nextDraft);
    await suggestSlots(nextDraft);
  }

  function chooseChatSlot(action: Extract<CustomerAssistantAction, { type: 'chooseChatSlot' }>) {
    const nextDraft = {
      ...bookingDraft,
      phase: 'details' as const,
      serviceId: action.payload.serviceId,
      providerId: action.payload.providerId,
      selectedDate: action.payload.date,
      slot: {
        startUtc: action.payload.startUtc,
        endUtc: action.payload.endUtc,
        status: 'available' as const,
        providerId: action.payload.providerId,
      },
    };
    setBookingDraft(nextDraft);
    const hasNameEmail = nextDraft.details.customerName && nextDraft.details.customerEmail;
    addAssistantMessage(
      hasNameEmail
        ? 'I prefilled your name and email from your account. Complete the secure details form below to continue.'
        : 'Great. Complete the secure details form below and I will prepare the final review.',
    );
  }

  function requiredIntakeFields(draft = bookingDraft) {
    return (selectedService(draft)?.intakeFields ?? []).filter((field) => field.required);
  }

  function buildWizardHandoff(draft = bookingDraft): BookingWizardHandoff | null {
    const location = selectedLocation(draft);
    if (
      !location ||
      !draft.serviceId ||
      !draft.providerId ||
      !draft.selectedDate ||
      !draft.slot?.startUtc ||
      !draft.details.customerName.trim() ||
      !draft.details.customerEmail.trim() ||
      !draft.details.customerPhone.trim()
    ) {
      return null;
    }

    const missingRequiredIntake = requiredIntakeFields(draft).some((field) => {
      const value = draft.intakeAnswers[field.id]?.trim() ?? '';
      if (!value) return true;
      if (field.type !== 'checkbox') return false;
      try {
        const parsed = JSON.parse(value) as unknown;
        return !Array.isArray(parsed) || parsed.length === 0;
      } catch {
        return true;
      }
    });
    if (missingRequiredIntake) return null;

    return {
      locationId: location.id,
      serviceId: draft.serviceId,
      providerId: draft.providerId,
      selectedDate: draft.selectedDate,
      startUtc: draft.slot.startUtc,
      customerName: draft.details.customerName,
      customerEmail: draft.details.customerEmail,
      customerPhone: draft.details.customerPhone,
      intakeAnswers: draft.intakeAnswers,
    };
  }

  function saveWizardHandoff() {
    if (typeof window === 'undefined') return null;
    const handoff = buildWizardHandoff();
    if (!handoff) return null;
    const key = crypto.randomUUID();
    window.sessionStorage.setItem(`${CHAT_BOOKING_HANDOFF_PREFIX}:${key}`, JSON.stringify(handoff));
    return key;
  }

  function openBookingPageWithOptionalHandoff(href: string) {
    const key = saveWizardHandoff();
    window.location.href = key ? bookingPageHref(context.org, key) : href;
  }

  function askIntakeQuestion(draft: ChatBookingDraft) {
    const fields = requiredIntakeFields(draft);
    const field = fields[draft.intakeIndex];
    if (!field) {
      showBookingReview({ ...draft, phase: 'review' });
      return;
    }

    const options = optionValues(field);
    addAssistantMessage(
      `${field.label}${field.helpText ? `\n${field.helpText}` : ''}`,
      options.length > 0
        ? options.slice(0, 5).map((option) => ({
            type: 'answerIntake',
            label: option,
            payload: { fieldId: field.id, value: option },
          }))
        : [],
    );
  }

  function continueAfterDetails(draft: ChatBookingDraft) {
    const fields = requiredIntakeFields(draft);
    if (fields.length > 0) {
      const nextDraft = { ...draft, phase: 'intake' as const, intakeIndex: 0 };
      setBookingDraft(nextDraft);
      addAssistantMessage('A few extra questions are required for this service.');
      askIntakeQuestion(nextDraft);
      return;
    }
    showBookingReview({ ...draft, phase: 'review' });
  }

  function handleDetailsInput(content: string) {
    const parsed = parseDetailsInput(content);
    const details = {
      customerName: parsed.customerName || bookingDraft.details.customerName,
      customerEmail: parsed.customerEmail || bookingDraft.details.customerEmail,
      customerPhone: parsed.customerPhone || bookingDraft.details.customerPhone,
    };
    const validation = bookingDetailsSchema.safeParse(details);
    if (!validation.success) {
      const issue = validation.error.issues[0]?.message ?? 'Please provide name, email, and phone.';
      setBookingDraft({ ...bookingDraft, details });
      addAssistantMessage(`${issue}\nReply like: Jane Doe, jane@email.com, +971501234567`);
      return;
    }

    const nextDraft = { ...bookingDraft, details: validation.data };
    setBookingDraft(nextDraft);
    continueAfterDetails(nextDraft);
  }

  function handleDetailsFormSubmit() {
    const validation = bookingDetailsSchema.safeParse({
      customerName: detailsForm.customerName.trim(),
      customerEmail: detailsForm.customerEmail.trim(),
      customerPhone: detailsForm.customerPhone.trim(),
    });
    if (!validation.success) {
      setDetailsError(validation.error.issues[0]?.message ?? 'Please complete your name, email, and phone.');
      return;
    }

    setDetailsError('');
    const nextDraft = { ...bookingDraft, details: validation.data };
    setBookingDraft(nextDraft);
    continueAfterDetails(nextDraft);
  }

  function handleIntakeAnswer(fieldId: string, value: string) {
    const fields = requiredIntakeFields();
    const currentField = fields[bookingDraft.intakeIndex];
    const targetField = fields.find((field) => field.id === fieldId) ?? currentField;
    if (!targetField) return;
    const answerValue =
      targetField.type === 'checkbox' ? JSON.stringify([value.trim()]) : value.trim();
    const nextAnswers = { ...bookingDraft.intakeAnswers, [targetField.id]: answerValue };
    const nextDraft = {
      ...bookingDraft,
      intakeAnswers: nextAnswers,
      intakeIndex: bookingDraft.intakeIndex + 1,
    };
    setBookingDraft(nextDraft);
    const errors = validateIntakeFields(fields, nextAnswers);
    if (Object.keys(errors).length > 0 && nextDraft.intakeIndex >= fields.length) {
      const firstError = Object.values(errors)[0];
      addAssistantMessage(firstError ?? 'Please answer all required questions.');
      setBookingDraft({
        ...nextDraft,
        intakeIndex: Math.max(0, fields.findIndex((field) => errors[field.id])),
      });
      return;
    }
    askIntakeQuestion(nextDraft);
  }

  function showBookingReview(draft: ChatBookingDraft) {
    const service = selectedService(draft);
    const provider = selectedProvider(draft);
    const location = selectedLocation(draft);
    if (!service || !provider || !location || !draft.slot) return;
    const when = formatInTimeZone(new Date(draft.slot.startUtc), location.timezone, 'PPpp');
    const intakeLines = requiredIntakeFields(draft)
      .map((field) => `- ${field.label}: ${displayIntakeAnswer(field, draft.intakeAnswers[field.id] ?? '')}`)
      .join('\n');
    const nextDraft = { ...draft, phase: 'review' as const };
    setBookingDraft(nextDraft);
    addAssistantMessage(
      [
        'Please review before I book it:',
        `Service: ${service.name}`,
        `Staff: ${provider.name}`,
        `When: ${when}`,
        `Name: ${draft.details.customerName}`,
        `Email: ${draft.details.customerEmail}`,
        `Phone: ${draft.details.customerPhone}`,
        intakeLines ? `Questions:\n${intakeLines}` : '',
        'Click Confirm booking only if everything is correct.',
      ].filter(Boolean).join('\n'),
      [
        { type: 'confirmBooking', label: 'Confirm booking', payload: {} },
        { type: 'editChatBooking', label: 'Change time', payload: { target: 'time' } },
        { type: 'editChatBooking', label: 'Change service', payload: { target: 'service' } },
        { type: 'editChatBooking', label: 'Change staff', payload: { target: 'provider' } },
        { type: 'editChatBooking', label: 'Change details', payload: { target: 'details' } },
        { type: 'openUrl', label: 'Use booking page instead', payload: { href: bookingPageHref(context.org) } },
      ],
    );
  }

  async function editChatBooking(target: 'service' | 'provider' | 'time' | 'details') {
    if (target === 'service') {
      const nextDraft = {
        ...bookingDraft,
        phase: 'service' as const,
        serviceId: undefined,
        providerId: undefined,
        selectedDate: undefined,
        timePreference: null,
        slot: undefined,
        providers: [],
        intakeAnswers: {},
        intakeIndex: 0,
      };
      setBookingDraft(nextDraft);
      addAssistantMessage('No problem. Choose a different service.', serviceActions(nextDraft.contextData?.services ?? []));
      return;
    }

    if (target === 'provider') {
      if (!bookingDraft.serviceId || !bookingDraft.locationId) return;
      let providers = bookingDraft.providers;
      if (providers.length === 0) {
        setLoading(true);
        try {
          providers = await loadProviders(bookingDraft.locationId, bookingDraft.serviceId);
        } finally {
          setLoading(false);
        }
      }
      const nextDraft = {
        ...bookingDraft,
        phase: 'provider' as const,
        providerId: undefined,
        selectedDate: undefined,
        timePreference: null,
        slot: undefined,
        providers,
      };
      setBookingDraft(nextDraft);
      addAssistantMessage('Sure. Choose a different staff member.', providerActions(providers));
      return;
    }

    if (target === 'time') {
      const nextDraft = {
        ...bookingDraft,
        phase: 'slot' as const,
        selectedDate: undefined,
        timePreference: null,
        slot: undefined,
      };
      setBookingDraft(nextDraft);
      addAssistantMessage('Tell me when you prefer, for example “tomorrow evening” or “next Friday after 3”.');
      await suggestSlots(nextDraft);
      return;
    }

    const nextDraft = { ...bookingDraft, phase: 'details' as const };
    setBookingDraft(nextDraft);
    addAssistantMessage('Sure. Send the corrected name, email, and phone in one message.');
  }

  async function resumeChatBooking() {
    if (bookingDraft.phase === 'review') {
      showBookingReview(bookingDraft);
      return;
    }
    if (bookingDraft.phase === 'service') {
      addAssistantMessage('Continue by choosing a service.', serviceActions(bookingDraft.contextData?.services ?? []));
      return;
    }
    if (bookingDraft.phase === 'provider') {
      addAssistantMessage('Continue by choosing a staff member.', providerActions(bookingDraft.providers));
      return;
    }
    if (bookingDraft.phase === 'slot') {
      addAssistantMessage('Continue by choosing a slot, or tell me another time preference.');
      await suggestSlots(bookingDraft, bookingDraft.selectedDate, bookingDraft.timePreference);
      return;
    }
    if (bookingDraft.phase === 'details') {
      addAssistantMessage('Continue by sending name, email, and phone.');
      return;
    }
    if (bookingDraft.phase === 'intake') {
      askIntakeQuestion(bookingDraft);
    }
  }

  async function submitChatBooking() {
    const service = selectedService();
    const location = selectedLocation();
    if (!service || !location || !bookingDraft.serviceId || !bookingDraft.providerId || !bookingDraft.slot) {
      addAssistantMessage('I need a service, staff member, and slot before I can book.');
      return;
    }

    setLoading(true);
    try {
      const freshSlots = await loadSlots(
        location.id,
        bookingDraft.serviceId,
        bookingDraft.providerId,
        bookingDraft.selectedDate ?? todayInTimezone(location.timezone),
      );
      const stillAvailable = freshSlots.some(
        (slot) =>
          Math.abs(new Date(slot.startUtc).getTime() - new Date(bookingDraft.slot!.startUtc).getTime()) < 60_000,
      );
      if (!stillAvailable) {
        addAssistantMessage('That slot is no longer available. Here are available alternatives.');
        await suggestSlots({ ...bookingDraft, phase: 'slot', slot: undefined });
        return;
      }

      await ensureCsrf();
      const result = await api<BookingResult>('/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          locationId: location.id,
          serviceId: bookingDraft.serviceId,
          providerId: bookingDraft.providerId,
          startUtc: bookingDraft.slot.startUtc,
          customerName: bookingDraft.details.customerName,
          customerEmail: bookingDraft.details.customerEmail,
          customerPhone: bookingDraft.details.customerPhone,
          customerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          idempotencyKey: crypto.randomUUID(),
          source: CHAT_BOOKING_SOURCE,
          metadata: JSON.stringify({ org: context.org, source: CHAT_BOOKING_SOURCE }),
          intakeResponses: buildIntakePayload(bookingDraft.intakeAnswers),
        }),
      });
      const manageHref = result.manageUrl ?? (result.manageToken ? `/manage/${result.manageToken}?partner=1` : bookingPageHref(context.org));
      setBookingDraft({
        ...bookingDraft,
        phase: 'booked',
        booked: { id: result.id, manageToken: result.manageToken, manageUrl: manageHref },
      });
      toast.success('Appointment booked successfully');
      addAssistantMessage('Your appointment is booked. You can manage or reschedule it from the button below.', [
        { type: 'openUrl', label: 'Manage booking', payload: { href: manageHref } },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Booking failed';
      toast.error(message);
      addAssistantMessage(
        message.toLowerCase().includes('payment')
          ? 'This booking needs payment, so please complete it on the full booking page.'
          : message,
        [{ type: 'openUrl', label: 'Go to booking page', payload: { href: bookingPageHref(context.org) } }],
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleChatBookingInput(content: string) {
    if (bookingDraft.phase === 'service') {
      const service = findServiceByText(content, bookingDraft.contextData?.services ?? []);
      if (service) await chooseChatService(service.id);
      else addAssistantMessage('Please choose one of the available services.', serviceActions(bookingDraft.contextData?.services ?? []));
      return;
    }
    if (bookingDraft.phase === 'provider') {
      const provider = findProviderByText(content, bookingDraft.providers);
      if (provider) await chooseChatProvider(provider.id);
      else addAssistantMessage('Please choose a staff member, or choose any available staff.', providerActions(bookingDraft.providers));
      return;
    }
    if (bookingDraft.phase === 'slot') {
      const location = selectedLocation();
      const date = location ? dateFromText(content, location.timezone) : undefined;
      const preference = timePreferenceFromText(content);
      await suggestSlots(
        { ...bookingDraft, timePreference: preference ?? bookingDraft.timePreference },
        date,
        preference ?? bookingDraft.timePreference,
      );
      return;
    }
    if (bookingDraft.phase === 'details') {
      handleDetailsInput(content);
      return;
    }
    if (bookingDraft.phase === 'intake') {
      const fields = requiredIntakeFields();
      const field = fields[bookingDraft.intakeIndex];
      if (field) handleIntakeAnswer(field.id, content);
      return;
    }
    if (bookingDraft.phase === 'review') {
      if (/booking page|full booking|use booking page/i.test(content)) {
        window.location.href = bookingPageHref(context.org);
        return;
      }
      if (/\b(confirm|yes|book)\b/i.test(content)) await submitChatBooking();
      else addAssistantMessage('Click Confirm booking when you are ready, or use the full booking page.', [
        { type: 'confirmBooking', label: 'Confirm booking', payload: {} },
        { type: 'openUrl', label: 'Go to booking page', payload: { href: bookingPageHref(context.org) } },
      ]);
    }
  }

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || loading || actionBusyRef.current) return;

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    if (['idle', 'booked'].includes(bookingDraft.phase)) {
      if (isBookWithMeText(content) || isShowServicesText(content)) {
        actionBusyRef.current = true;
        try {
          await startChatBooking();
        } finally {
          actionBusyRef.current = false;
        }
        return;
      }
    }

    if (!['idle', 'booked'].includes(bookingDraft.phase)) {
      await handleChatBookingInput(content);
      return;
    }

    setLoading(true);
    try {
      const response = await api<AssistantResponse>('/ai/customer-assistant', {
        method: 'POST',
        body: JSON.stringify({
          ...assistantContext,
          message: content,
          messages: compactMessages,
        }),
      });
      await wait(250);
      const responseActions = suppressRedundantActions(response.actions ?? []).map(staffLanguageAction);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: staffLanguageText(response.message),
          actions: responseActions,
          quickReplies: cleanQuickReplies(
            responseActions,
            (response.quickReplies ?? []).map(staffLanguageText),
          ),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Assistant failed';
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action: CustomerAssistantAction) {
    if (loading || actionBusyRef.current) return;

    actionBusyRef.current = true;
    const finishAction = () => {
      actionBusyRef.current = false;
    };
    const runAction = (task: () => Promise<void> | void) => {
      try {
        const result = task();
        if (result instanceof Promise) void result.finally(finishAction);
        else finishAction();
      } catch (error) {
        finishAction();
        throw error;
      }
    };

    if (action.type === 'openUrl') {
      if (action.payload.href.includes('/book')) {
        openBookingPageWithOptionalHandoff(action.payload.href);
      } else {
        window.location.href = action.payload.href;
      }
      return;
    }
    if (action.type === 'startChatBooking') {
      runAction(() => startChatBooking(action.payload.serviceId, action.payload.locationId));
      return;
    }
    if (action.type === 'chooseChatService') {
      runAction(() => chooseChatService(action.payload.serviceId));
      return;
    }
    if (action.type === 'chooseChatProvider') {
      runAction(() => chooseChatProvider(action.payload.providerId));
      return;
    }
    if (action.type === 'chooseChatSlot') {
      runAction(() => chooseChatSlot(action));
      return;
    }
    if (action.type === 'answerIntake') {
      runAction(() => handleIntakeAnswer(action.payload.fieldId, action.payload.value));
      return;
    }
    if (action.type === 'collectCustomerDetails') {
      runAction(() => {
        setBookingDraft((prev) => ({ ...prev, phase: 'details' }));
        addAssistantMessage('I opened the secure details form below.');
        window.setTimeout(() => detailsNameRef.current?.focus(), 0);
      });
      return;
    }
    if (action.type === 'collectIntake') {
      runAction(() => {
        const nextDraft = { ...bookingDraft, phase: 'intake' as const, intakeIndex: 0 };
        setBookingDraft(nextDraft);
        askIntakeQuestion(nextDraft);
      });
      return;
    }
    if (action.type === 'confirmBooking') {
      runAction(() => submitChatBooking());
      return;
    }
    if (action.type === 'resumeChatBooking') {
      runAction(() => resumeChatBooking());
      return;
    }
    if (action.type === 'editChatBooking') {
      runAction(() => editChatBooking(action.payload.target));
      return;
    }
    if (action.type === 'selectService') {
      setAssistantSelection((prev) => ({
        ...prev,
        serviceId: action.payload.serviceId,
        providerId: undefined,
        selectedDate: undefined,
        startUtc: undefined,
      }));
      if (!onAction) {
        runAction(() => startChatBooking(action.payload.serviceId));
        return;
      }
    }
    if (action.type === 'selectProvider') {
      setAssistantSelection((prev) => ({
        ...prev,
        providerId: action.payload.providerId,
        selectedDate: undefined,
        startUtc: undefined,
      }));
    }
    if (action.type === 'selectDate') {
      setAssistantSelection((prev) => ({
        ...prev,
        selectedDate: action.payload.date,
        startUtc: undefined,
      }));
    }
    if (action.type === 'selectSlot') {
      setAssistantSelection((prev) => ({
        ...prev,
        serviceId: action.payload.serviceId,
        providerId: action.payload.providerId,
        selectedDate: action.payload.date,
        startUtc: action.payload.startUtc,
      }));
    }
    onAction?.(action);
    const actionMessage =
      action.type === 'selectSlot'
        ? `I selected ${action.label}. Continue with your details and confirm only when everything looks right.`
        : action.type === 'goToStep'
          ? `I moved you to the right step. Follow the instructions on the page.`
          : `Selected: ${action.label}. You can still review everything before confirming.`;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: actionMessage,
      },
    ]);
    finishAction();
  }

  function startVoiceInput() {
    if (loading || listening) return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    voiceTextRef.current = '';

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;
        if (result.isFinal) finalText += `${transcript} `;
        else interimText = transcript;
      }

      const spokenText = (finalText || interimText).trim();
      if (spokenText) {
        voiceTextRef.current = spokenText;
        setInput(spokenText);
      }
    };

    recognition.onerror = () => {
      voiceTextRef.current = '';
      setListening(false);
      toast.error('Could not hear that. Please try again.');
    };

    recognition.onend = () => {
      setListening(false);
      const spokenText = voiceTextRef.current.trim();
      if (spokenText) void sendMessage(spokenText);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      toast.error('Could not start voice input. Please try again.');
    }
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
  }

  function resetChat() {
    recognitionRef.current?.abort();
    setListening(false);
    setInput('');
    setIntroTyping(false);
    setMessages([]);
    setBookingDraft(emptyDraft());
    setAssistantSelection({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(legacyStorageKey);
      window.localStorage.removeItem(draftStorageKey);
    }
    if (user) {
      void api(`/ai/customer-assistant/history?${historyQuery}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="assistant-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="flex h-[min(580px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-sm origin-bottom-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{ASSISTANT_NAME}</p>
                <p className="text-xs text-text-secondary">Private booking concierge</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-2 text-text-muted hover:bg-slate-100 hover:text-text-primary dark:hover:bg-slate-900"
                onClick={resetChat}
                aria-label="Reset assistant chat"
                title="Reset chat"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-text-muted hover:bg-slate-100 hover:text-text-primary dark:hover:bg-slate-900"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 scroll-py-5">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-text-primary dark:border-slate-800 dark:bg-slate-900',
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.actions.slice(0, 6).map((action, index) => (
                        <button
                          key={`${action.type}-${action.label}-${index}`}
                          type="button"
                          disabled={loading}
                          className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-slate-950 dark:text-brand-300"
                          onClick={() => handleAction(action)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.quickReplies.slice(0, 2).map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          disabled={loading}
                          className="rounded-full bg-slate-200/70 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                          onClick={() => void sendMessage(reply)}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {bookingDraft.phase === 'details' && (
              <motion.form
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-brand-50/40 to-violet-50 p-3 shadow-sm dark:border-brand-900 dark:from-slate-950 dark:via-brand-950/20 dark:to-slate-900"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleDetailsFormSubmit();
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Your booking details</p>
                    <p className="text-xs text-text-secondary">Used only for confirmation and reminders.</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300">
                    Secure
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="relative block">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      ref={detailsNameRef}
                      className="h-10 rounded-xl bg-white pl-9 text-sm dark:bg-slate-950"
                      value={detailsForm.customerName}
                      onChange={(event) =>
                        setDetailsForm((prev) => ({ ...prev, customerName: event.target.value }))
                      }
                      placeholder="Full name"
                      disabled={loading}
                    />
                  </label>
                  <label className="relative block">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      className="h-10 rounded-xl bg-white pl-9 text-sm dark:bg-slate-950"
                      value={detailsForm.customerEmail}
                      onChange={(event) =>
                        setDetailsForm((prev) => ({ ...prev, customerEmail: event.target.value }))
                      }
                      placeholder="Email address"
                      type="email"
                      disabled={loading}
                    />
                  </label>
                  <div className="block">
                    <PhoneInput
                      className="!h-10 !rounded-xl"
                      value={detailsForm.customerPhone}
                      onChange={(value) =>
                        setDetailsForm((prev) => ({ ...prev, customerPhone: value ?? '' }))
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
                {detailsError && <p className="mt-2 text-xs text-red-600">{detailsError}</p>}
                <Button
                  type="submit"
                  className="mt-3 h-10 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
                  disabled={loading}
                >
                  Continue to review
                </Button>
              </motion.form>
            )}
            {(introTyping || loading) && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-secondary dark:border-slate-800 dark:bg-slate-900">
                  <span>{ASSISTANT_NAME} is typing</span>
                  <span className="ml-1 inline-flex gap-0.5 align-middle">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <Input
              ref={inputRef}
              className="min-w-0 flex-1"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                listening
                  ? 'Listening...'
                  : bookingDraft.phase === 'details'
                    ? 'Name, email, phone...'
                    : bookingDraft.phase === 'intake'
                      ? 'Type your answer...'
                      : 'Ask for help or a slot...'
              }
              disabled={loading || listening}
            />
            <Button
              type="button"
              size="icon"
              variant={listening ? 'default' : 'outline'}
              disabled={loading}
              onClick={listening ? stopVoiceInput : startVoiceInput}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Stop voice input' : 'Start voice input'}
              className="h-10 w-10 shrink-0 rounded-xl p-0"
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl p-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          </motion.div>
        ) : (
          <motion.button
            key="assistant-bubble"
            type="button"
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setOpen(true)}
            aria-label={`Open ${ASSISTANT_NAME}`}
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
