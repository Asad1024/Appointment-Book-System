import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Calendar date (YYYY-MM-DD) for “today” in a location timezone — not UTC midnight. */
export function calendarDateInTimezone(timezone: string, date = new Date()): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function addCalendarDays(dateStr: string, days: number, timezone: string): string {
  const anchor = fromZonedTime(`${dateStr}T12:00:00`, timezone);
  return formatInTimeZone(addDays(anchor, days), timezone, 'yyyy-MM-dd');
}

export function formatTimezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}
