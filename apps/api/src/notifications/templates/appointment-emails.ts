import { NotificationType } from '@pkg/shared-types';
import { emailButton, emailCalendarLinks, emailHeading, emailLayout, emailParagraph } from './layout';

export interface AppointmentEmailData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string | null;
  serviceName: string;
  providerName: string;
  locationName?: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  customerTimezone?: string | null;
  manageUrl: string;
  googleCalendarUrl: string;
  icsDownloadUrl: string;
  adminAppointmentUrl?: string;
}

const SUBJECTS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'Appointment confirmed',
  [NotificationType.REMINDER_24H]: 'Reminder: appointment in 24 hours',
  [NotificationType.REMINDER_1H]: 'Reminder: appointment in 1 hour',
  [NotificationType.RESCHEDULED]: 'Appointment rescheduled',
  [NotificationType.CANCELLED]: 'Appointment cancelled',
};

const HEADINGS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'Your appointment is confirmed',
  [NotificationType.REMINDER_24H]: 'Reminder: 24 hours to go',
  [NotificationType.REMINDER_1H]: 'Reminder: 1 hour to go',
  [NotificationType.RESCHEDULED]: 'Your appointment was rescheduled',
  [NotificationType.CANCELLED]: 'Your appointment was cancelled',
};

const INTROS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]:
    'Thanks for booking with us. Here are your appointment details.',
  [NotificationType.REMINDER_24H]: 'This is a friendly reminder about your upcoming appointment.',
  [NotificationType.REMINDER_1H]: 'Your appointment starts in about one hour.',
  [NotificationType.RESCHEDULED]: 'Your appointment time has been updated.',
  [NotificationType.CANCELLED]: 'Your appointment has been cancelled as requested.',
};

function formatWhen(data: AppointmentEmailData): string {
  const when = `${data.startUtc} (${data.timezone})`;
  if (data.customerTimezone) {
    return `${when}<br /><span style="color:#64748b;font-size:13px;">Your time zone: ${data.customerTimezone}</span>`;
  }
  return when;
}

export function appointmentEmail(
  type: NotificationType,
  data: AppointmentEmailData,
): { subject: string; html: string } {
  const subject = SUBJECTS[type] ?? 'Appointment update';
  const heading = HEADINGS[type] ?? 'Appointment update';
  const intro = INTROS[type] ?? 'Details for your appointment:';

  const body = [
    emailHeading(heading),
    emailParagraph(`Hi ${data.customerName},`),
    emailParagraph(intro),
    emailParagraph(
      `<strong>${data.serviceName}</strong> with ${data.providerName}<br />When: ${formatWhen(data)}`,
    ),
    type !== NotificationType.CANCELLED ? emailCalendarLinks(data.googleCalendarUrl, data.icsDownloadUrl) : '',
    type !== NotificationType.CANCELLED
      ? emailButton(data.manageUrl, 'Manage appointment')
      : '',
  ].join('');

  return { subject, html: emailLayout(body) };
}

export const bookingConfirmationEmail = (data: AppointmentEmailData) =>
  appointmentEmail(NotificationType.BOOKING_CONFIRMATION, data);

export const reminder24hEmail = (data: AppointmentEmailData) =>
  appointmentEmail(NotificationType.REMINDER_24H, data);

export const reminder1hEmail = (data: AppointmentEmailData) =>
  appointmentEmail(NotificationType.REMINDER_1H, data);

export const rescheduledEmail = (data: AppointmentEmailData) =>
  appointmentEmail(NotificationType.RESCHEDULED, data);

export const cancelledEmail = (data: AppointmentEmailData) =>
  appointmentEmail(NotificationType.CANCELLED, data);

const PROVIDER_SUBJECTS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'New appointment booked',
  [NotificationType.REMINDER_24H]: 'Reminder: appointment in 24 hours',
  [NotificationType.REMINDER_1H]: 'Reminder: appointment in 1 hour',
  [NotificationType.RESCHEDULED]: 'Appointment rescheduled',
  [NotificationType.CANCELLED]: 'Appointment cancelled',
};

const PROVIDER_HEADINGS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'New booking on your calendar',
  [NotificationType.REMINDER_24H]: 'Upcoming appointment in 24 hours',
  [NotificationType.REMINDER_1H]: 'Upcoming appointment in 1 hour',
  [NotificationType.RESCHEDULED]: 'A booking was rescheduled',
  [NotificationType.CANCELLED]: 'A booking was cancelled',
};

const PROVIDER_INTROS: Record<string, string> = {
  [NotificationType.BOOKING_CONFIRMATION]: 'A new appointment has been scheduled with you.',
  [NotificationType.REMINDER_24H]: 'Reminder about an appointment on your schedule.',
  [NotificationType.REMINDER_1H]: 'This appointment starts in about one hour.',
  [NotificationType.RESCHEDULED]: 'An appointment on your calendar was rescheduled.',
  [NotificationType.CANCELLED]: 'An appointment on your calendar was cancelled.',
};

/** Staff/provider copy — includes customer contact details. */
export function providerAppointmentEmail(
  type: NotificationType,
  data: AppointmentEmailData,
): { subject: string; html: string } {
  const subject = PROVIDER_SUBJECTS[type] ?? 'Appointment update';
  const heading = PROVIDER_HEADINGS[type] ?? 'Appointment update';
  const intro = PROVIDER_INTROS[type] ?? 'Appointment details:';

  const customerContact = [
    data.customerEmail ? `Email: ${data.customerEmail}` : '',
    data.customerPhone ? `Phone: ${data.customerPhone}` : '',
  ]
    .filter(Boolean)
    .join('<br />');

  const body = [
    emailHeading(heading),
    emailParagraph(`Hi ${data.providerName},`),
    emailParagraph(intro),
    emailParagraph(
      [
        `<strong>${data.serviceName}</strong>`,
        data.locationName ? `Location: ${data.locationName}` : '',
        `Customer: ${data.customerName}`,
        customerContact,
        `When: ${formatWhen(data)}`,
      ]
        .filter(Boolean)
        .join('<br />'),
    ),
    data.adminAppointmentUrl && type !== NotificationType.CANCELLED
      ? emailButton(data.adminAppointmentUrl, 'View in dashboard')
      : '',
  ].join('');

  return { subject, html: emailLayout(body) };
}
