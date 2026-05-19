import { formatInTimeZone } from 'date-fns-tz';

export type CalendarEventInput = {
  title: string;
  startUtc: string;
  endUtc: string;
  /** IANA timezone — Google Calendar shows the same wall-clock time as the site. */
  timezone: string;
  description?: string;
  location?: string;
};

/** Wall-clock time in the given timezone for Google Calendar (no Z suffix). */
function toGoogleLocalDate(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "yyyyMMdd'T'HHmmss");
}

/** Opens Google Calendar with event fields pre-filled (user clicks Save once). */
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

export function openGoogleCalendar(event: CalendarEventInput): void {
  window.open(buildGoogleCalendarUrl(event), '_blank', 'noopener,noreferrer');
}

/** Universal .ics file for Outlook, Apple Calendar, etc. (UTC). */
export function downloadIcsFile(event: CalendarEventInput, filename = 'appointment.ics'): void {
  const dtStart = event.startUtc.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtEnd = event.endUtc.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotwise//Appointment//EN',
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

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
