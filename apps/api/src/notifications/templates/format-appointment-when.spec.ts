import { formatAppointmentWhenHtml, formatAppointmentWhenPlain } from './format-appointment-when';
import type { AppointmentEmailData } from './appointment-emails';

const base: AppointmentEmailData = {
  customerName: 'Test',
  serviceName: 'Discovery Call',
  providerName: 'Ali Chen',
  startUtc: '2026-05-22T06:45:00.000Z',
  endUtc: '2026-05-22T07:15:00.000Z',
  timezone: 'Asia/Dubai',
  customerTimezone: 'Asia/Karachi',
  manageUrl: 'https://example.com/manage',
  googleCalendarUrl: 'https://example.com/gcal',
  icsDownloadUrl: 'https://example.com/ics',
};

describe('formatAppointmentWhen', () => {
  it('shows both customer and office times when zones differ', () => {
    const html = formatAppointmentWhenHtml(base);
    expect(html).toContain('Your time:');
    expect(html).toContain('Office time:');
    expect(html).toContain('Asia/Karachi');
    expect(html).toContain('Asia/Dubai');
    expect(html).not.toContain('T06:45:00');
  });

  it('shows a single line when customer matches office timezone', () => {
    const html = formatAppointmentWhenHtml({ ...base, customerTimezone: 'Asia/Dubai' });
    expect(html).toContain('Your time:');
    expect(html).not.toContain('Office time:');
  });

  it('formats plain text for WhatsApp', () => {
    const text = formatAppointmentWhenPlain(base);
    expect(text).toContain('Your time:');
    expect(text).toContain('Office time:');
    expect(text).not.toContain('.000Z');
  });
});
