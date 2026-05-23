import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 15 * 60 * 1000;
const PREFILL_MAX_AGE_MS = 10 * 60 * 1000;

export type GoogleAuthIntent =
  | 'customer'
  | 'staff'
  | 'business_signup'
  | 'invite_accept';

export type GoogleAuthFlow = 'login' | 'register';

export type GoogleAuthRequestedRole =
  | 'customer'
  | 'provider'
  | 'admin'
  | 'super_admin';

export type GoogleAuthStatePayload = {
  intent: GoogleAuthIntent;
  flow?: GoogleAuthFlow;
  orgSlug?: string;
  inviteToken?: string;
  requestedRole?: GoogleAuthRequestedRole;
  next?: string;
  failurePath?: string;
  companyName?: string;
  adminName?: string;
  timezone?: string;
  iat: number;
  nonce: string;
};

export type GoogleSignupPrefillPayload = {
  email: string;
  name: string;
  avatarUrl?: string | null;
  iat: number;
  nonce: string;
};

function stateSecret(): string {
  return process.env.JWT_SECRET ?? process.env.CSRF_SECRET ?? 'dev-google-auth-state';
}

function sign(input: string): string {
  return createHmac('sha256', stateSecret()).update(input).digest('hex');
}

export function signGoogleAuthState(
  payload: Omit<GoogleAuthStatePayload, 'iat' | 'nonce'>,
): string {
  const body = JSON.stringify({
    ...payload,
    iat: Date.now(),
    nonce: randomBytes(10).toString('hex'),
  } satisfies GoogleAuthStatePayload);
  const encoded = Buffer.from(body, 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGoogleAuthState(state: string): GoogleAuthStatePayload {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) {
    throw new Error('Invalid OAuth state');
  }

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid OAuth state signature');
  }

  let payload: GoogleAuthStatePayload;
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    payload = JSON.parse(json) as GoogleAuthStatePayload;
  } catch {
    throw new Error('Invalid OAuth state payload');
  }

  if (!payload?.intent || !payload.iat || !payload.nonce) {
    throw new Error('Invalid OAuth state payload');
  }
  if (payload.flow && payload.flow !== 'login' && payload.flow !== 'register') {
    throw new Error('Invalid OAuth state payload');
  }
  if (Date.now() - payload.iat > MAX_AGE_MS) {
    throw new Error('OAuth state expired');
  }
  return payload;
}

export function signGoogleSignupPrefillToken(
  payload: Omit<GoogleSignupPrefillPayload, 'iat' | 'nonce'>,
): string {
  const body = JSON.stringify({
    ...payload,
    iat: Date.now(),
    nonce: randomBytes(10).toString('hex'),
  } satisfies GoogleSignupPrefillPayload);
  const encoded = Buffer.from(body, 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGoogleSignupPrefillToken(token: string): GoogleSignupPrefillPayload {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new Error('Invalid signup prefill token');
  }

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid signup prefill token');
  }

  let payload: GoogleSignupPrefillPayload;
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    payload = JSON.parse(json) as GoogleSignupPrefillPayload;
  } catch {
    throw new Error('Invalid signup prefill token');
  }

  if (!payload?.email || !payload?.name || !payload?.iat || !payload?.nonce) {
    throw new Error('Invalid signup prefill token');
  }
  if (Date.now() - payload.iat > PREFILL_MAX_AGE_MS) {
    throw new Error('Signup prefill token expired');
  }
  return payload;
}
