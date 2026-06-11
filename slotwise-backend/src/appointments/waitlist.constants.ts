export const WAITLIST_STATUS = {
  ACTIVE: 'active',
  NOTIFIED: 'notified',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type WaitlistStatus = (typeof WAITLIST_STATUS)[keyof typeof WAITLIST_STATUS];

export const WAITLIST_OPEN_STATUSES: WaitlistStatus[] = [
  WAITLIST_STATUS.ACTIVE,
  WAITLIST_STATUS.NOTIFIED,
];
