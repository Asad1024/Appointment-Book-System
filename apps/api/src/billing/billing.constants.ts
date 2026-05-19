/** Free tier monthly confirmed bookings per organization. */
export const FREE_MONTHLY_APPOINTMENT_LIMIT = 25;

/** Pro tier (mock subscribe) — high cap until Stripe meters usage. */
export const PRO_MONTHLY_APPOINTMENT_LIMIT = 10_000;

export const SUBSCRIPTION_PLAN = {
  FREE: 'free',
  PRO: 'pro',
} as const;

export const SUBSCRIPTION_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
} as const;

/** Pro subscription — charged in AED (Stripe: amount in fils, 1000 AED = 100_000). */
export const PRO_PRICE_CURRENCY = 'aed';
export const PRO_PRICE_AMOUNT_AED = 1000;
export const PRO_PRICE_AMOUNT_MINOR = PRO_PRICE_AMOUNT_AED * 100;

export function formatProPriceDisplay(): string {
  const formatted = new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(PRO_PRICE_AMOUNT_AED);
  return `${formatted} / month`;
}
