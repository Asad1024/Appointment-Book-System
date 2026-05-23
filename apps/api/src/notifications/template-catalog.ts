import { NotificationType, formatReminderOffsetLabel } from '@pkg/shared-types';

export type TemplateChannel = 'email' | 'whatsapp';
export type TemplateAudience = 'customer' | 'provider';
export type TemplateEventType =
  | 'booking_confirmation'
  | 'reminder'
  | 'rescheduled'
  | 'cancelled';

export type TemplateDefinition = {
  key: string;
  channel: TemplateChannel;
  audience: TemplateAudience;
  eventType: TemplateEventType;
  label: string;
  description: string;
  supportsSubject: boolean;
  systemDefault: {
    subject: string | null;
    body: string;
  };
};

type DefinitionInput = Omit<TemplateDefinition, 'key'>;

function keyOf(
  channel: TemplateChannel,
  audience: TemplateAudience,
  eventType: TemplateEventType,
): string {
  return `${channel}:${audience}:${eventType}`;
}

function definition(input: DefinitionInput): TemplateDefinition {
  return {
    ...input,
    key: keyOf(input.channel, input.audience, input.eventType),
  };
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  definition({
    channel: 'email',
    audience: 'customer',
    eventType: 'booking_confirmation',
    label: 'Customer booking confirmation email',
    description: 'Sent right after booking is confirmed.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Appointment confirmed',
      body:
        'Hi {{customer_name}},\n\nYour appointment is confirmed.\nService: {{service_name}}\nProvider: {{provider_name}}\nWhen: {{appointment_when_html}}\n\nManage: {{manage_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'customer',
    eventType: 'reminder',
    label: 'Customer reminder email',
    description: 'Sent before the appointment based on reminder schedule.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Reminder: appointment {{reminder_label}}',
      body:
        'Hi {{customer_name}},\n\nThis is a reminder for your appointment ({{reminder_label}}).\nService: {{service_name}}\nProvider: {{provider_name}}\nWhen: {{appointment_when_html}}\n\nManage: {{manage_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'customer',
    eventType: 'rescheduled',
    label: 'Customer rescheduled email',
    description: 'Sent when appointment date/time is changed.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Appointment rescheduled',
      body:
        'Hi {{customer_name}},\n\nYour appointment was rescheduled.\nService: {{service_name}}\nProvider: {{provider_name}}\nWhen: {{appointment_when_html}}\n\nManage: {{manage_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'customer',
    eventType: 'cancelled',
    label: 'Customer cancellation email',
    description: 'Sent when appointment is cancelled.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Appointment cancelled',
      body:
        'Hi {{customer_name}},\n\nYour appointment has been cancelled.\nService: {{service_name}}\nProvider: {{provider_name}}\nWhen: {{appointment_when_html}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'provider',
    eventType: 'booking_confirmation',
    label: 'Provider booking confirmation email',
    description: 'Sent to provider for new booking.',
    supportsSubject: true,
    systemDefault: {
      subject: 'New appointment booked',
      body:
        'Hi {{provider_name}},\n\nA new booking was added to your calendar.\nCustomer: {{customer_name}}\nService: {{service_name}}\nWhen: {{appointment_when_html}}\n\nView in dashboard: {{admin_appointment_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'provider',
    eventType: 'reminder',
    label: 'Provider reminder email',
    description: 'Reminder sent to provider before appointment.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Reminder: appointment {{reminder_label}}',
      body:
        'Hi {{provider_name}},\n\nReminder for your appointment ({{reminder_label}}).\nCustomer: {{customer_name}}\nService: {{service_name}}\nWhen: {{appointment_when_html}}\n\nView in dashboard: {{admin_appointment_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'provider',
    eventType: 'rescheduled',
    label: 'Provider rescheduled email',
    description: 'Sent to provider when appointment changes.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Appointment rescheduled',
      body:
        'Hi {{provider_name}},\n\nAn appointment on your calendar was rescheduled.\nCustomer: {{customer_name}}\nService: {{service_name}}\nWhen: {{appointment_when_html}}\n\nView in dashboard: {{admin_appointment_url}}',
    },
  }),
  definition({
    channel: 'email',
    audience: 'provider',
    eventType: 'cancelled',
    label: 'Provider cancellation email',
    description: 'Sent to provider when appointment is cancelled.',
    supportsSubject: true,
    systemDefault: {
      subject: 'Appointment cancelled',
      body:
        'Hi {{provider_name}},\n\nAn appointment on your calendar was cancelled.\nCustomer: {{customer_name}}\nService: {{service_name}}\nWhen: {{appointment_when_html}}',
    },
  }),
  definition({
    channel: 'whatsapp',
    audience: 'customer',
    eventType: 'booking_confirmation',
    label: 'Customer booking confirmation WhatsApp',
    description: 'WhatsApp message sent right after booking confirmation.',
    supportsSubject: false,
    systemDefault: {
      subject: null,
      body:
        '*Booking confirmed*\n\nHi {{customer_name}},\nYour appointment has been successfully confirmed.\n\n*Service:* {{service_name}}\n*Provider:* {{provider_name}}\n*Location:* {{location_name}}\n*When:* {{appointment_when_plain}}\n\n*Manage booking*\n{{manage_url}}\n\n*Add to calendar*\n{{ics_download_url}}\n\nNeed help? Reply to this message.',
    },
  }),
  definition({
    channel: 'whatsapp',
    audience: 'customer',
    eventType: 'reminder',
    label: 'Customer reminder WhatsApp',
    description: 'WhatsApp reminder before appointment.',
    supportsSubject: false,
    systemDefault: {
      subject: null,
      body:
        '*Appointment reminder ({{reminder_label}})*\n\nHi {{customer_name}},\nFriendly reminder: your appointment is {{reminder_label}}.\n\n*Service:* {{service_name}}\n*Provider:* {{provider_name}}\n*Location:* {{location_name}}\n*When:* {{appointment_when_plain}}\n\n*Manage booking*\n{{manage_url}}\n\n*Add to calendar*\n{{ics_download_url}}\n\nNeed help? Reply to this message.',
    },
  }),
  definition({
    channel: 'whatsapp',
    audience: 'customer',
    eventType: 'rescheduled',
    label: 'Customer rescheduled WhatsApp',
    description: 'WhatsApp message when appointment is rescheduled.',
    supportsSubject: false,
    systemDefault: {
      subject: null,
      body:
        '*Appointment rescheduled*\n\nHi {{customer_name}},\nYour appointment details were updated.\n\n*Service:* {{service_name}}\n*Provider:* {{provider_name}}\n*Location:* {{location_name}}\n*When:* {{appointment_when_plain}}\n\n*Manage booking*\n{{manage_url}}\n\n*Add to calendar*\n{{ics_download_url}}\n\nNeed help? Reply to this message.',
    },
  }),
  definition({
    channel: 'whatsapp',
    audience: 'customer',
    eventType: 'cancelled',
    label: 'Customer cancellation WhatsApp',
    description: 'WhatsApp message when appointment is cancelled.',
    supportsSubject: false,
    systemDefault: {
      subject: null,
      body:
        '*Appointment cancelled*\n\nHi {{customer_name}},\nYour appointment has been cancelled.\n\n*Service:* {{service_name}}\n*Provider:* {{provider_name}}\n*Location:* {{location_name}}\n*When:* {{appointment_when_plain}}\n\nIf this cancellation is unexpected, please contact support.',
    },
  }),
];

const BY_KEY = new Map(TEMPLATE_DEFINITIONS.map((item) => [item.key, item]));

export function templateKey(
  channel: TemplateChannel,
  audience: TemplateAudience,
  eventType: TemplateEventType,
): string {
  return keyOf(channel, audience, eventType);
}

export function templateDefinitionFor(
  channel: TemplateChannel,
  audience: TemplateAudience,
  eventType: TemplateEventType,
): TemplateDefinition | null {
  return BY_KEY.get(keyOf(channel, audience, eventType)) ?? null;
}

export function supportedTemplateTokens(): string[] {
  return [
    '{{customer_name}}',
    '{{customer_email}}',
    '{{customer_phone}}',
    '{{service_name}}',
    '{{provider_name}}',
    '{{location_name}}',
    '{{appointment_when_html}}',
    '{{appointment_when_plain}}',
    '{{manage_url}}',
    '{{google_calendar_url}}',
    '{{ics_download_url}}',
    '{{admin_appointment_url}}',
    '{{reminder_label}}',
  ];
}

export function mapNotificationTypeToTemplateEvent(
  type: NotificationType,
): TemplateEventType | null {
  if (type === NotificationType.BOOKING_CONFIRMATION) return 'booking_confirmation';
  if (
    type === NotificationType.REMINDER ||
    type === NotificationType.REMINDER_24H ||
    type === NotificationType.REMINDER_1H
  ) {
    return 'reminder';
  }
  if (type === NotificationType.RESCHEDULED) return 'rescheduled';
  if (type === NotificationType.CANCELLED) return 'cancelled';
  return null;
}

export function reminderLabel(minutesBefore?: number): string {
  if (!minutesBefore || minutesBefore <= 0) return 'soon';
  return formatReminderOffsetLabel(minutesBefore);
}

export function renderTemplateString(
  text: string,
  tokens: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (full, tokenName) => {
    const key = String(tokenName ?? '').toLowerCase();
    return tokens[key] ?? full;
  });
}
