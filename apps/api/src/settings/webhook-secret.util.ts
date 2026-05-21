import { randomBytes } from 'crypto';

/** Signing secret for outbound webhooks (HMAC-SHA256). Shown once in admin UI. */
export function generateWebhookSigningSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}
