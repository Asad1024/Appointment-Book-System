const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export function getApiUrl() {
  return API_URL;
}

function formatErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const msg = (body as { message: string | string[] }).message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_URL}/auth/csrf`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load CSRF token');
        const data = (await res.json()) as { token: string };
        csrfToken = data.token;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

function isMutation(method?: string) {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE';
}

async function buildHeaders(options?: RequestInit): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (isMutation(options?.method)) {
    const token = await ensureCsrf();
    headers['x-csrf-token'] = token;
  }
  return headers;
}

const AUTH_SIGN_IN_PATHS = new Set(['/auth/login', '/auth/register']);

function friendlySignInMessage(message: string): string {
  if (!message || message === 'Unauthorized' || message === 'Invalid credentials') {
    return 'Invalid email or password.';
  }
  return message;
}

async function handleResponse<T>(res: Response, requestPath?: string): Promise<T> {
  if (res.status === 401) {
    const err = await res.json().catch(() => null);
    const message = formatErrorMessage(err, '');
    const apiPath =
      err && typeof err === 'object' && 'path' in err
        ? String((err as { path: string }).path)
        : '';
    const isSignInAttempt =
      AUTH_SIGN_IN_PATHS.has(apiPath) ||
      (requestPath != null && AUTH_SIGN_IN_PATHS.has(requestPath));

    // Wrong email/password on sign-in — not a session timeout
    if (isSignInAttempt) {
      throw new Error(friendlySignInMessage(message));
    }

    if (message && message !== 'Unauthorized') {
      throw new Error(message);
    }
    throw new Error('Session expired. Please sign in again.');
  }
  if (res.status === 403) {
    const err = await res.json().catch(() => null);
    throw new Error(formatErrorMessage(err, 'Access denied'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(formatErrorMessage(err, res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: await buildHeaders(options),
  });
  return handleResponse<T>(res, path);
}

/** Authenticated API call (session via httpOnly cookies). */
export async function apiAuth<T>(path: string, options?: RequestInit): Promise<T> {
  return api<T>(path, options);
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  csrfToken = null;
}

export type ReminderPreferences = {
  remindersEnabled: boolean;
  reminderOffsetsMinutes: number[] | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  providerId?: string | null;
  reminderPreferences?: ReminderPreferences;
};

export async function fetchMe(): Promise<AuthUser> {
  return apiAuth<AuthUser>('/auth/me');
}
