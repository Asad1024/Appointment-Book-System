/** Stripe-compatible booking currencies (lowercase ISO 4217). */
export const DEFAULT_BOOKING_CURRENCY = 'aed' as const;

export const BOOKING_CURRENCIES = [
  { code: 'aed', label: 'UAE Dirham', symbol: 'AED' },
  { code: 'usd', label: 'US Dollar', symbol: '$' },
  { code: 'eur', label: 'Euro', symbol: '€' },
  { code: 'gbp', label: 'British Pound', symbol: '£' },
  { code: 'pkr', label: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'sar', label: 'Saudi Riyal', symbol: 'SAR' },
  { code: 'inr', label: 'Indian Rupee', symbol: '₹' },
  { code: 'cad', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'aud', label: 'Australian Dollar', symbol: 'A$' },
] as const;

export type BookingCurrencyCode = (typeof BOOKING_CURRENCIES)[number]['code'];

const CODE_SET = new Set<string>(BOOKING_CURRENCIES.map((c) => c.code));

export function normalizeBookingCurrency(code?: string | null): BookingCurrencyCode {
  const normalized = (code ?? DEFAULT_BOOKING_CURRENCY).trim().toLowerCase();
  if (CODE_SET.has(normalized)) return normalized as BookingCurrencyCode;
  return DEFAULT_BOOKING_CURRENCY;
}

export function getBookingCurrencyMeta(code?: string | null) {
  const normalized = normalizeBookingCurrency(code);
  return BOOKING_CURRENCIES.find((c) => c.code === normalized) ?? BOOKING_CURRENCIES[0];
}

export function formatMoneyFromCents(cents: number, currencyCode?: string | null): string {
  if (!cents || cents <= 0) return 'Free';
  const code = normalizeBookingCurrency(currencyCode);
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    const meta = getBookingCurrencyMeta(code);
    return `${meta.symbol}${(cents / 100).toFixed(2)}`;
  }
}

export function bookingCurrencyLabel(code?: string | null): string {
  const meta = getBookingCurrencyMeta(code);
  return `${meta.label} (${meta.symbol})`;
}
