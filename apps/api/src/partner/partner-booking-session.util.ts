import { randomBytes } from 'crypto';

const TOKEN_BYTES = 12;

export function generatePartnerSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function partnerSessionExpiresAt(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
