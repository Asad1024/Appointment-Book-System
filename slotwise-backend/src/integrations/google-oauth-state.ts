import { createHmac, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.JWT_SECRET ?? process.env.CSRF_SECRET ?? 'dev-google-oauth-state';
}

export function signGoogleOAuthState(providerId: string): string {
  const issuedAt = Date.now();
  const payload = `${providerId}:${issuedAt}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyGoogleOAuthState(state: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8');
  } catch {
    throw new Error('Invalid OAuth state');
  }
  const parts = decoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid OAuth state');
  const [providerId, issuedAtStr, sig] = parts;
  const payload = `${providerId}:${issuedAtStr}`;
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid OAuth state signature');
  }
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) {
    throw new Error('OAuth state expired');
  }
  return providerId;
}
