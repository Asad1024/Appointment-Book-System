const STORAGE_KEY = 'booking_customer_timezone';

/** Common IANA zones shown in booking pickers (browser/saved/custom zones are added dynamically). */
export const COMMON_BOOKING_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const;

export function getBrowserTimezone(): string {
  if (typeof window === 'undefined') return 'UTC';
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function loadSavedBookingTimezone(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function saveBookingTimezone(timezone: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = timezone?.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Pick the customer's timezone for slot display:
 * 1) remembered choice, 2) device timezone, 3) office/location fallback.
 */
export function resolveInitialCustomerTimezone(officeTimezone?: string): string {
  const saved = loadSavedBookingTimezone();
  if (saved) return saved;

  const browser = getBrowserTimezone();
  if (browser && browser !== 'UTC') return browser;

  const office = officeTimezone?.trim();
  if (office) return office;

  return 'UTC';
}

export function timezoneOptionsFor(currentValue: string): string[] {
  const set = new Set<string>(COMMON_BOOKING_TIMEZONES);
  const browser = getBrowserTimezone();
  if (browser) set.add(browser);
  const saved = loadSavedBookingTimezone();
  if (saved) set.add(saved);
  if (currentValue?.trim()) set.add(currentValue.trim());
  return Array.from(set);
}
