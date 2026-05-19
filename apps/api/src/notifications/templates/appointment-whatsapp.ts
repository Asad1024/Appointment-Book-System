import { NotificationType } from '@pkg/shared-types';
import type { AppointmentEmailData } from './appointment-emails';

const SUBJECTS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'Appointment confirmed',
  [NotificationType.REMINDER_24H]: 'Reminder: appointment in 24 hours',
  [NotificationType.REMINDER_1H]: 'Reminder: appointment in 1 hour',
  [NotificationType.RESCHEDULED]: 'Appointment rescheduled',
  [NotificationType.CANCELLED]: 'Appointment cancelled',
};

const INTROS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]:
    'Thanks for booking with us. Here are your appointment details.',
  [NotificationType.REMINDER_24H]: 'Friendly reminder about your upcoming appointment.',
  [NotificationType.REMINDER_1H]: 'Your appointment starts in about one hour.',
  [NotificationType.RESCHEDULED]: 'Your appointment time has been updated.',
  [NotificationType.CANCELLED]: 'Your appointment has been cancelled.',
};

export function appointmentWhatsAppMessage(
  type: NotificationType,
  data: AppointmentEmailData,
): string {
  const title = SUBJECTS[type] ?? 'Appointment update';
  const intro = INTROS[type] ?? 'Details for your appointment:';
  const when = data.customerTimezone
    ? `${data.startUtc} (${data.timezone}, your TZ: ${data.customerTimezone})`
    : `${data.startUtc} (${data.timezone})`;

  const lines = [
    title,
    '',
    `Hi ${data.customerName},`,
    intro,
    '',
    `Service: ${data.serviceName}`,
    `Provider: ${data.providerName}`,
    data.locationName ? `Location: ${data.locationName}` : null,
    `When: ${when}`,
    type !== NotificationType.CANCELLED ? `Add to Google Calendar: ${data.googleCalendarUrl}` : null,
    type !== NotificationType.CANCELLED ? `Manage: ${data.manageUrl}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}
