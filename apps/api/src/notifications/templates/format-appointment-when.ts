import { DateTime } from 'luxon';
import type { AppointmentEmailData } from './appointment-emails';

function timezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}

function formatWallClock(iso: string, timezone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone);
  if (!dt.isValid) return iso;
  return dt.toFormat('cccc, LLL d, yyyy · h:mm a');
}

export function formatAppointmentWhenHtml(data: AppointmentEmailData): string {
  const officeTz = data.timezone?.trim() || 'UTC';
  const customerTz = data.customerTimezone?.trim() || officeTz;
  const yourWhen = formatWallClock(data.startUtc, customerTz);
  const sameZone = customerTz === officeTz;

  const lines = [
    `<strong>Your time:</strong> ${yourWhen} (${timezoneLabel(customerTz)})`,
  ];

  if (!sameZone) {
    const officeWhen = formatWallClock(data.startUtc, officeTz);
    lines.push(
      `<br /><span style="color:#64748b;font-size:13px;"><strong>Office time:</strong> ${officeWhen} (${timezoneLabel(officeTz)})</span>`,
    );
  }

  return lines.join('');
}

export function formatAppointmentWhenPlain(data: AppointmentEmailData): string {
  const officeTz = data.timezone?.trim() || 'UTC';
  const customerTz = data.customerTimezone?.trim() || officeTz;
  const yourWhen = formatWallClock(data.startUtc, customerTz);
  const sameZone = customerTz === officeTz;

  if (sameZone) {
    return `Your time: ${yourWhen} (${timezoneLabel(customerTz)})`;
  }

  const officeWhen = formatWallClock(data.startUtc, officeTz);
  return `Your time: ${yourWhen} (${timezoneLabel(customerTz)}). Office time: ${officeWhen} (${timezoneLabel(officeTz)})`;
}
