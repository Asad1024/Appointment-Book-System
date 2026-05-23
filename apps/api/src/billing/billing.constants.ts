/** Free tier monthly confirmed bookings per organization. */
export const FREE_MONTHLY_APPOINTMENT_LIMIT = 25;

/** Pro tier monthly confirmed bookings per organization. */
export const PRO_MONTHLY_APPOINTMENT_LIMIT = 1_500;

/** Scale tier monthly confirmed bookings per organization. */
export const SCALE_MONTHLY_APPOINTMENT_LIMIT = 10_000;

/** Plan limits: team and catalog size. */
export const FREE_STAFF_LIMIT = 2;
export const PRO_STAFF_LIMIT = 12;
export const FREE_LOCATION_LIMIT = 1;
export const PRO_LOCATION_LIMIT = 3;
export const FREE_SERVICE_LIMIT = 5;
export const PRO_SERVICE_LIMIT = 40;

/** Grace window after payment expiry/failure before blocking new bookings. */
export const BILLING_GRACE_PERIOD_DAYS = 5;

/** Hourly reconciliation keeps billing state correct if webhook events are missed. */
export const BILLING_LIFECYCLE_CRON = '0 * * * *';

export const SUBSCRIPTION_PLAN = {
  FREE: 'free',
  PRO: 'pro',
  SCALE: 'scale',
} as const;

export const SUBSCRIPTION_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  GRACE_ENDED: 'grace_ended',
  CANCELLED: 'cancelled',
} as const;

/** Pro subscription charged in AED (Stripe amount in minor units, 1000 AED = 100_000). */
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
