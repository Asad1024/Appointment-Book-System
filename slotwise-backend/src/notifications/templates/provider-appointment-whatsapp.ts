import { NotificationType, formatReminderOffsetLabel } from '@pkg/shared-types';
import type { AppointmentEmailData } from './appointment-emails';
import { formatAppointmentWhenPlain } from './format-appointment-when';

const TITLES: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'New appointment booked',
  [NotificationType.REMINDER_24H]: 'Appointment reminder (in 24 hours)',
  [NotificationType.REMINDER_1H]: 'Appointment reminder (in 1 hour)',
  [NotificationType.RESCHEDULED]: 'Appointment rescheduled',
  [NotificationType.CANCELLED]: 'Appointment cancelled',
};

const INTROS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'A new appointment has been scheduled with you.',
  [NotificationType.REMINDER_24H]: 'Reminder about an upcoming appointment on your schedule.',
  [NotificationType.REMINDER_1H]: 'This appointment starts in about one hour.',
  [NotificationType.RESCHEDULED]: 'An appointment on your calendar was rescheduled.',
  [NotificationType.CANCELLED]: 'An appointment on your calendar was cancelled.',
};

export function providerAppointmentWhatsAppMessage(
  type: NotificationType,
  data: AppointmentEmailData,
  opts?: { reminderMinutesBefore?: number },
): string {
  let title = TITLES[type] ?? 'Appointment update';
  let intro = INTROS[type] ?? 'Appointment details:';

  if (type === NotificationType.REMINDER && opts?.reminderMinutesBefore) {
    const label = formatReminderOffsetLabel(opts.reminderMinutesBefore);
    title = `Appointment reminder (${label})`;
    intro = `Reminder about an appointment on your schedule (${label}).`;
  } else if (type === NotificationType.REMINDER_24H) {
    title = TITLES[NotificationType.REMINDER_24H];
    intro = INTROS[NotificationType.REMINDER_24H];
  } else if (type === NotificationType.REMINDER_1H) {
    title = TITLES[NotificationType.REMINDER_1H];
    intro = INTROS[NotificationType.REMINDER_1H];
  }

  const when = formatAppointmentWhenPlain(data);
  const contactLines = [
    data.customerEmail ? `*Email:* ${data.customerEmail}` : null,
    data.customerPhone ? `*Phone:* ${data.customerPhone}` : null,
  ].filter(Boolean);

  const lines: Array<string | null> = [
    `*${title}*`,
    '',
    `Hi ${data.providerName},`,
    intro,
    '',
    `*Service:* ${data.serviceName}`,
    data.locationName ? `*Location:* ${data.locationName}` : null,
    `*Customer:* ${data.customerName}`,
    ...contactLines,
    `*When:* ${when}`,
  ];

  if (type !== NotificationType.CANCELLED && data.adminAppointmentUrl) {
    lines.push('', '*View in dashboard*', data.adminAppointmentUrl);
  }

  return lines.filter((line) => line !== null).join('\n');
}
