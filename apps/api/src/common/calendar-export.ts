import { DateTime } from 'luxon';

export type CalendarEventInput = {
  title: string;
  startUtc: string;
  endUtc: string;
  /** IANA timezone — event times in Google match this zone (customer or location). */
  timezone: string;
  description?: string;
  location?: string;
};

/** Wall-clock time in the given timezone for Google Calendar (no Z suffix). */
function toGoogleLocalDate(iso: string, timeZone: string): string {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timeZone);
  if (!dt.isValid) {
    const fallback = DateTime.fromISO(iso, { zone: 'utc' });
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${fallback.year}${pad(fallback.month)}${pad(fallback.day)}` +
      `T${pad(fallback.hour)}${pad(fallback.minute)}${pad(fallback.second)}`
    );
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.year}${pad(dt.month)}${pad(dt.day)}T${pad(dt.hour)}${pad(dt.minute)}${pad(dt.second)}`;
}

export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const tz = event.timezone || 'UTC';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleLocalDate(event.startUtc, tz)}/${toGoogleLocalDate(event.endUtc, tz)}`,
    ctz: tz,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(event: CalendarEventInput): string {
  const dtStart = event.startUtc.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtEnd = event.endUtc.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotwise//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${event.description.replace(/,/g, '\\,').replace(/\n/g, '\\n')}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${event.location.replace(/,/g, '\\,')}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function calendarEventFromAppointment(appt: {
  service: { name: string };
  provider: { name: string };
  location: { name: string; address?: string | null; timezone: string };
  startUtc: Date;
  endUtc: Date;
  timezone: string;
  customerTimezone?: string | null;
}): CalendarEventInput {
  return {
    title: appt.service.name,
    startUtc: appt.startUtc.toISOString(),
    endUtc: appt.endUtc.toISOString(),
    timezone: appt.customerTimezone ?? appt.timezone,
    description: `With ${appt.provider.name}`,
    location: [appt.location.name, appt.location.address].filter(Boolean).join(' — '),
  };
}

export function publicApiBaseUrl(): string {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  const port = process.env.API_PORT ?? '3001';
  return `http://localhost:${port}`;
}
