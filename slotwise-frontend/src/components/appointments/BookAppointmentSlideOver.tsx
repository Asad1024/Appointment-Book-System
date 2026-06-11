'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiAuth } from '@/lib/api';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/booking-dates';
import { bookingLinkSourceLabel } from '@/lib/booking-link-attribution';
import { DateTimePicker } from '@/components/booking/DateTimePicker';
import { SlideOver } from '@/components/admin/SlideOver';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { isValidPhoneValue } from '@/lib/phone';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type BookingLinkPair = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  providerId: string;
  providerName: string;
};

type BookingLinkOptions = {
  locationId: string;
  pairs: BookingLinkPair[];
};

type Slot = { startUtc: string; endUtc: string; status?: 'available' | 'booked' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_BOOKING_WINDOW_DAYS = 60;

function createIdempotencyKey() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  const rand = Math.random().toString(16).slice(2);
  return `idemp-${Date.now().toString(36)}-${rand}`;
}

export function BookAppointmentSlideOver({
  open,
  onOpenChange,
  locationId,
  locationTimezone,
  sourceDefault = 'staff',
  fixedProviderId,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationTimezone: string;
  sourceDefault?: string;
  fixedProviderId?: string;
  onBooked?: () => Promise<void> | void;
}) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [options, setOptions] = useState<BookingLinkOptions | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [providerId, setProviderId] = useState(fixedProviderId ?? '');

  const [linkName, setLinkName] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [startUtc, setStartUtc] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotTimezone, setSlotTimezone] = useState(locationTimezone);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const topRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const minBookDate = useMemo(
    () => calendarDateInTimezone(locationTimezone),
    [locationTimezone],
  );
  const maxBookDate = useMemo(
    () => addCalendarDays(minBookDate, DEFAULT_BOOKING_WINDOW_DAYS, locationTimezone),
    [minBookDate, locationTimezone],
  );

  const services = useMemo(() => {
    const byId = new Map<string, BookingLinkPair>();
    for (const pair of options?.pairs ?? []) {
      if (!fixedProviderId || pair.providerId === fixedProviderId) {
        byId.set(pair.serviceId, pair);
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  }, [options?.pairs, fixedProviderId]);

  const providersForService = useMemo(() => {
    if (!serviceId) return [];
    return (options?.pairs ?? [])
      .filter((p) => p.serviceId === serviceId)
      .sort((a, b) => a.providerName.localeCompare(b.providerName));
  }, [options?.pairs, serviceId]);

  const fixedProviderChoices = useMemo(() => {
    if (!fixedProviderId) return [];
    const byId = new Map<string, BookingLinkPair>();
    for (const pair of options?.pairs ?? []) {
      if (pair.providerId === fixedProviderId) {
        byId.set(pair.providerId, pair);
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.providerName.localeCompare(b.providerName));
  }, [options?.pairs, fixedProviderId]);

  const providerChoices =
    fixedProviderId && !serviceId ? fixedProviderChoices : providersForService;

  const resetState = useCallback(() => {
    setOptions(null);
    setServiceId('');
    setProviderId(fixedProviderId ?? '');
    setLinkName('');
    setBookingUrl('');
    setLinkExpiresAt(null);
    setSelectedDate('');
    setStartUtc('');
    setSlots([]);
    setSlotsLoading(false);
    setSlotTimezone(locationTimezone);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setNotes('');
    setCreateLoading(false);
    setError('');
    setSuccess('');
  }, [fixedProviderId, locationTimezone]);

  const loadOptions = useCallback(async () => {
    if (!locationId) return;
    setLoadingOptions(true);
    try {
      const data = await apiAuth<BookingLinkOptions>(
        `/catalog/staff/booking-link-options?locationId=${encodeURIComponent(locationId)}`,
      );
      setOptions(data);
      setError('');
      setSuccess('');
    } catch (e) {
      setOptions(null);
      setError(e instanceof Error ? e.message : 'Failed to load booking options');
    } finally {
      setLoadingOptions(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadOptions();
  }, [open, loadOptions, resetState]);

  useEffect(() => {
    if (!serviceId && services.length === 1) {
      setServiceId(services[0].serviceId);
    }
  }, [services, serviceId]);

  useEffect(() => {
    if (fixedProviderId) {
      setProviderId(fixedProviderId);
      return;
    }
    if (!providerId && providersForService.length === 1) {
      setProviderId(providersForService[0].providerId);
    }
  }, [providersForService, providerId, fixedProviderId]);

  useEffect(() => {
    if (!providerId || fixedProviderId) return;
    if (!providersForService.some((p) => p.providerId === providerId)) {
      setProviderId('');
    }
  }, [providerId, providersForService, fixedProviderId]);

  useEffect(() => {
    setSelectedDate('');
    setStartUtc('');
    setSlots([]);
    setBookingUrl('');
    setLinkExpiresAt(null);
    setError('');
    setSuccess('');
  }, [serviceId, providerId]);

  useEffect(() => {
    if (!open || !locationId || !serviceId || !providerId || !selectedDate) return;
    setSlotsLoading(true);
    void apiAuth<{ slots: Slot[]; timezone: string }>(
      `/availability/slots?locationId=${encodeURIComponent(locationId)}&serviceId=${encodeURIComponent(serviceId)}&providerId=${encodeURIComponent(providerId)}&fromDate=${encodeURIComponent(selectedDate)}&toDate=${encodeURIComponent(selectedDate)}`,
    )
      .then((res) => {
        setSlots(res.slots ?? []);
        setSlotTimezone(res.timezone || locationTimezone);
      })
      .catch((e) => {
        setSlots([]);
        setError(e instanceof Error ? e.message : 'Failed to load slots');
      })
      .finally(() => setSlotsLoading(false));
  }, [open, locationId, serviceId, providerId, selectedDate, locationTimezone]);

  useEffect(() => {
    if (!open || !locationId || !serviceId || !providerId) {
      setBookingUrl('');
      setLinkExpiresAt(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLinkLoading(true);
      void apiAuth<{ url: string; expiresAt: string }>('/catalog/staff/booking-sessions', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          serviceId,
          providerId,
          campaign: linkName.trim() || undefined,
        }),
      })
        .then((res) => {
          if (cancelled) return;
          setBookingUrl(res.url);
          setLinkExpiresAt(res.expiresAt);
          setError('');
        })
        .catch((e) => {
          if (cancelled) return;
          setBookingUrl('');
          setLinkExpiresAt(null);
          setError(e instanceof Error ? e.message : 'Could not create booking link');
        })
        .finally(() => {
          if (!cancelled) setLinkLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, locationId, serviceId, providerId, linkName]);

  async function copyLink() {
    if (!bookingUrl) {
      toast.error('Select service and staff first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast.success('Booking link copied');
    } catch {
      toast.error('Could not copy booking link');
    }
  }

  async function createAppointment() {
    scrollToTop();
    setError('');
    setSuccess('');
    const cleanName = customerName.trim();
    const cleanEmail = customerEmail.trim().toLowerCase();
    const cleanPhone = customerPhone.trim();
    if (!serviceId || !providerId) {
      setError('Select a service and staff first.');
      return;
    }
    if (!selectedDate || !startUtc) {
      setError('Choose a date and time first.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Customer name is required.');
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Enter a valid customer email address.');
      return;
    }
    if (!isValidPhoneValue(cleanPhone)) {
      setError('Enter a valid customer phone number.');
      return;
    }

    setCreateLoading(true);
    try {
      const fresh = await apiAuth<{ slots: Slot[] }>(
        `/availability/slots?locationId=${encodeURIComponent(locationId)}&serviceId=${encodeURIComponent(serviceId)}&providerId=${encodeURIComponent(providerId)}&fromDate=${encodeURIComponent(selectedDate)}&toDate=${encodeURIComponent(selectedDate)}`,
      );
      const stillAvailable = (fresh.slots ?? []).some(
        (s) =>
          (s.status ?? 'available') === 'available' &&
          Math.abs(new Date(s.startUtc).getTime() - new Date(startUtc).getTime()) < 60_000,
      );
      if (!stillAvailable) {
        setSlots(fresh.slots ?? []);
        setError('This slot is no longer available. Please choose another time.');
        return;
      }

      const result = await apiAuth<{ status: string; startUtc?: string }>('/appointments/admin/book', {
        method: 'POST',
        body: JSON.stringify({
          locationId,
          serviceId,
          providerId,
          startUtc,
          customerName: cleanName,
          customerEmail: cleanEmail,
          customerPhone: cleanPhone,
          customerTimezone: slotTimezone || locationTimezone,
          notes: notes.trim() || undefined,
          idempotencyKey: createIdempotencyKey(),
        }),
      });
      toast.success(
        result.status === 'pending'
          ? 'Appointment request created (pending approval).'
          : 'Appointment created.',
      );
      setSuccess(
        result.status === 'pending'
          ? 'Appointment created and is pending approval.'
          : 'Appointment created successfully.',
      );
      setSelectedDate('');
      setStartUtc('');
      setSlots([]);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setNotes('');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('slotwise:appointment-created', {
            detail: { startUtc: result.startUtc ?? startUtc },
          }),
        );
      }
      await onBooked?.();
      scrollToTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create appointment');
      scrollToTop();
    } finally {
      setCreateLoading(false);
    }
  }

  const noPairs = !loadingOptions && options != null && options.pairs.length === 0;

  return (
    <SlideOver
      open={open}
      onClose={() => onOpenChange(false)}
      title="Book Appointment"
      description="Create a booking link or add an appointment directly."
      className="max-w-2xl"
    >
      <div ref={topRef} />
      {success && <Alert variant="success">{success}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {loadingOptions ? (
        <p className="text-sm text-text-secondary">Loading booking options...</p>
      ) : noPairs ? (
        <Alert>
          No active service-provider combinations are available for this location.
        </Alert>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Service</Label>
              <Select value={serviceId || undefined} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.serviceId} value={s.serviceId}>
                      {s.serviceName} ({s.durationMinutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Staff</Label>
              <Select
                value={providerId || undefined}
                onValueChange={setProviderId}
                disabled={!!fixedProviderId || !serviceId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={
                      fixedProviderId
                        ? 'Staff'
                        : serviceId
                          ? 'Choose staff'
                          : 'Select service first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providerChoices.map((p) => (
                    <SelectItem key={p.providerId} value={p.providerId}>
                      {p.providerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="link">
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <TabsTrigger
                value="link"
                className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary"
              >
                Link
              </TabsTrigger>
              <TabsTrigger
                value="create"
                className="rounded-lg px-4 data-[state=active]:bg-brand-600 data-[state=active]:text-white dark:data-[state=active]:bg-brand-600 dark:data-[state=active]:text-white data-[state=inactive]:text-text-secondary"
              >
                Create
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-4 pt-3">
              <div>
                <Label htmlFor="book-source">Shared from</Label>
                <Input
                  id="book-source"
                  className="mt-1.5"
                  value={bookingLinkSourceLabel(sourceDefault)}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="book-link-name">Link name (optional)</Label>
                <Input
                  id="book-link-name"
                  className="mt-1.5"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="e.g. front-desk-qr"
                />
              </div>

              {(linkLoading || bookingUrl) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <Label>Booking URL</Label>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-sm text-text-secondary dark:border-slate-700 dark:bg-slate-950">
                    {linkLoading ? 'Generating link...' : bookingUrl}
                  </div>
                  {linkExpiresAt && (
                    <p className="mt-2 text-xs text-text-muted">
                      Expires at {new Date(linkExpiresAt).toLocaleString()}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void copyLink()} disabled={!bookingUrl}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <a
                      href={bookingUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: 'outline' }),
                        !bookingUrl && 'pointer-events-none opacity-50',
                      )}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-4 pt-3">
              {!serviceId || !providerId ? (
                <Alert>
                  Select service and provider first to open the appointment form.
                </Alert>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <DateTimePicker
                      locationTimezone={slotTimezone || locationTimezone}
                      customerTimezone={slotTimezone || locationTimezone}
                      onCustomerTimezoneChange={() => {}}
                      selectedDate={selectedDate}
                      onDateChange={(date) => {
                        setSelectedDate(date);
                        setStartUtc('');
                      }}
                      startUtc={startUtc}
                      onSlotSelect={setStartUtc}
                      slots={slots}
                      loading={slotsLoading}
                      minDate={minBookDate}
                      maxDate={maxBookDate}
                      accentColor="#2563eb"
                      hideTimezone
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="book-customer-name">Customer name</Label>
                      <Input
                        id="book-customer-name"
                        className="mt-1.5"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="book-customer-email">Customer email</Label>
                      <Input
                        id="book-customer-email"
                        className="mt-1.5"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="book-customer-phone">Customer phone</Label>
                      <div className="mt-1.5">
                        <PhoneInput
                          id="book-customer-phone"
                          value={customerPhone}
                          onChange={(value) => setCustomerPhone(value ?? '')}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="book-notes">Notes (optional)</Label>
                      <Textarea
                        id="book-notes"
                        className="mt-1.5 min-h-[44px] py-2.5"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Internal notes"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void createAppointment()}
                      disabled={createLoading || !startUtc}
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {createLoading ? 'Creating...' : 'Create appointment'}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </SlideOver>
  );
}
