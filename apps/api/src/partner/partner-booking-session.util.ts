import { randomBytes } from 'crypto';

const TOKEN_BYTES = 12;

export function generatePartnerSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function partnerSessionExpiresAt(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/** Staff-shared customer links — longer TTL than partner CRM handoff sessions. */
export function staffBookingSessionExpiresAt(days?: number): Date {
  const ttlDays =
    days ??
    Number(process.env.STAFF_BOOKING_SESSION_TTL_DAYS ?? 30);
  const safeDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 30;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}
