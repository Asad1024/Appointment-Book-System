import { NotificationType, formatReminderOffsetLabel } from '@pkg/shared-types';
import type { AppointmentEmailData } from './appointment-emails';
import { formatAppointmentWhenPlain } from './format-appointment-when';

const SUBJECTS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'Booking confirmed',
  [NotificationType.REMINDER_24H]: 'Appointment reminder (in 24 hours)',
  [NotificationType.REMINDER_1H]: 'Appointment reminder (in 1 hour)',
  [NotificationType.RESCHEDULED]: 'Appointment rescheduled',
  [NotificationType.CANCELLED]: 'Appointment cancelled',
};

const INTROS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]:
    'Your appointment has been successfully confirmed.',
  [NotificationType.REMINDER_24H]: 'Friendly reminder about your upcoming appointment.',
  [NotificationType.REMINDER_1H]: 'Your appointment starts in about one hour.',
  [NotificationType.RESCHEDULED]: 'Your appointment details were updated.',
  [NotificationType.CANCELLED]: 'Your appointment has been cancelled.',
};

export function appointmentWhatsAppMessage(
  type: NotificationType,
  data: AppointmentEmailData,
  opts?: { reminderMinutesBefore?: number },
): string {
  let title = SUBJECTS[type] ?? 'Appointment update';
  let intro = INTROS[type] ?? 'Details for your appointment:';

  if (type === NotificationType.REMINDER && opts?.reminderMinutesBefore) {
    const label = formatReminderOffsetLabel(opts.reminderMinutesBefore);
    title = `Appointment reminder (${label})`;
    intro = `Friendly reminder: your appointment is ${label}.`;
  } else if (type === NotificationType.REMINDER_24H) {
    title = SUBJECTS[NotificationType.REMINDER_24H];
    intro = INTROS[NotificationType.REMINDER_24H];
  } else if (type === NotificationType.REMINDER_1H) {
    title = SUBJECTS[NotificationType.REMINDER_1H];
    intro = INTROS[NotificationType.REMINDER_1H];
  }

  const when = formatAppointmentWhenPlain(data);

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
    '',
    type !== NotificationType.CANCELLED ? `Manage booking: ${data.manageUrl}` : null,
    type !== NotificationType.CANCELLED
      ? `Add to calendar: ${data.googleCalendarUrl}`
      : null,
    '',
    type === NotificationType.CANCELLED
      ? 'If this cancellation is unexpected, please contact support.'
      : 'Need help? Reply to this message.',
  ].filter(Boolean);

  return lines.join('\n');
}
