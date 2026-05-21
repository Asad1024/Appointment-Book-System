'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, Clock, Globe, MapPin, User } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { BookingDetailsFormValues } from '@/lib/booking-details-schema';
import type { BookingIntakeField } from '@/lib/booking-intake';
import { formatMoneyFromCents, normalizeBookingCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppointmentTimeSummary } from '@/components/booking/AppointmentTimeSummary';
import { ReminderPreferencesEditor } from '@/components/shared/ReminderPreferencesEditor';
import { IntakeFieldsForm } from '@/components/booking/IntakeFieldsForm';

type ConfirmContext = {
  service: { name: string; durationMinutes: number; priceCents?: number | null; intakeFields: BookingIntakeField[] };
  provider: { name: string };
  location: { name: string; timezone: string };
  branding: { currency?: string };
};

export function PartnerBookingConfirmStep({
  ctx,
  startUtc,
  customerTimezone,
  leadLabel,
  primaryColor,
  form,
  intakeAnswers,
  intakeErrors,
  onIntakeChange,
  remindersEnabled,
  reminderSelectedMinutes,
  applicableReminderOffsets,
  onRemindersEnabledChange,
  onReminderSelectedChange,
  showReminders,
  needsPayment,
  priceCents,
  loading,
  onBack,
  onConfirm,
}: {
  ctx: ConfirmContext;
  startUtc: string;
  customerTimezone: string;
  leadLabel?: string | null;
  primaryColor: string;
  form: UseFormReturn<BookingDetailsFormValues>;
  intakeAnswers: Record<string, string>;
  intakeErrors: Record<string, string>;
  onIntakeChange: (fieldId: string, value: string) => void;
  remindersEnabled: boolean;
  reminderSelectedMinutes: number[];
  applicableReminderOffsets: number[];
  onRemindersEnabledChange: (v: boolean) => void;
  onReminderSelectedChange: (v: number[]) => void;
  showReminders: boolean;
  needsPayment: boolean;
  priceCents: number;
  loading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const start = new Date(startUtc);
  const end = addMinutes(start, ctx.service.durationMinutes);
  const dateLine = formatInTimeZone(start, customerTimezone, 'EEEE, MMMM d, yyyy');
  const timeLine = `${formatInTimeZone(start, customerTimezone, 'h:mm a')} – ${formatInTimeZone(end, customerTimezone, 'h:mm a')}`;
  const bookingCurrency = normalizeBookingCurrency(ctx.branding.currency);
  const officeTimezone = ctx.location.timezone;

  const confirmLabel = loading
    ? 'Please wait…'
    : needsPayment
      ? `Confirm · ${formatMoneyFromCents(priceCents, bookingCurrency)}`
      : 'Confirm';

  return (
    <div className="lg:grid lg:grid-cols-[minmax(260px,340px)_1fr]">
      <aside className="space-y-5 border-b border-slate-100 p-6 lg:border-b-0 lg:border-r dark:border-slate-800">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          {ctx.provider.name}
        </p>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{ctx.service.name}</h2>

        <ul className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              <span className="block font-medium text-slate-800 dark:text-slate-100">{dateLine}</span>
              <span className="text-slate-600 dark:text-slate-400">{timeLine}</span>
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{ctx.service.durationMinutes}m</span>
          </li>
          <li className="flex items-center gap-3">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{ctx.location.name}</span>
          </li>
          <li className="flex items-center gap-3">
            <Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>{customerTimezone.replace(/_/g, ' ')}</span>
          </li>
        </ul>

        <AppointmentTimeSummary
          startUtc={startUtc}
          endUtc={end.toISOString()}
          customerTimezone={customerTimezone}
          officeTimezone={officeTimezone}
          compact
        />

        {leadLabel ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Booking for <span className="font-medium text-slate-700 dark:text-slate-200">{leadLabel}</span>
          </p>
        ) : null}
      </aside>

      <div className="flex flex-col p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="partner-confirm-name">Your name</Label>
            <Input
              id="partner-confirm-name"
              className="mt-1.5"
              {...form.register('customerName')}
              aria-invalid={!!form.formState.errors.customerName}
            />
            {form.formState.errors.customerName && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.customerName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="partner-confirm-email">Email address</Label>
            <Input
              id="partner-confirm-email"
              type="email"
              className="mt-1.5"
              {...form.register('customerEmail')}
              aria-invalid={!!form.formState.errors.customerEmail}
            />
            {form.formState.errors.customerEmail && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.customerEmail.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="partner-confirm-phone">Phone</Label>
            <Input
              id="partner-confirm-phone"
              className="mt-1.5"
              required
              placeholder="+971501234567"
              {...form.register('customerPhone')}
              aria-invalid={!!form.formState.errors.customerPhone}
            />
            {form.formState.errors.customerPhone && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.customerPhone.message}</p>
            )}
          </div>

          {showReminders && (
            <ReminderPreferencesEditor
              enabled={remindersEnabled}
              selectedMinutes={reminderSelectedMinutes}
              allowedMinutes={applicableReminderOffsets}
              onEnabledChange={onRemindersEnabledChange}
              onSelectedChange={onReminderSelectedChange}
              description="Reminder times before this appointment."
            />
          )}

          <IntakeFieldsForm
            fields={ctx.service.intakeFields}
            answers={intakeAnswers}
            errors={intakeErrors}
            onChange={onIntakeChange}
          />

          {needsPayment && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You will complete payment on Stripe after confirming.
            </p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" disabled={loading} onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            disabled={loading}
            className="min-w-[7rem] rounded-lg px-5"
            style={{ backgroundColor: primaryColor }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
