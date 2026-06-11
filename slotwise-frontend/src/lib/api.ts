const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<void> | null = null;

function resetCsrfCache() {
  csrfToken = null;
  csrfPromise = null;
}

export function getApiUrl() {
  return API_URL;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  resource?: string;
  details?: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code =
      details && typeof details.code === 'string' ? details.code : undefined;
    this.resource =
      details && typeof details.resource === 'string' ? details.resource : undefined;
    this.details = details ?? null;
  }
}

function formatErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const msg = (body as { message: string | string[] }).message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

function networkErrorMessage(path: string, cause: unknown): string {
  const hint =
    typeof window !== 'undefined'
      ? ` (${window.location.origin} → ${API_URL})`
      : '';
  const detail = cause instanceof Error ? cause.message : 'Network error';
  return `Cannot reach API at ${API_URL}${path}${hint}. Is the API running on port 3003? ${detail}`;
}

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
      } catch (cause) {
        throw new Error(networkErrorMessage('/auth/csrf', cause));
      }
      if (!res.ok) throw new Error('Failed to load CSRF token');
      const data = (await res.json()) as { token: string };
      csrfToken = data.token;
      return csrfToken;
    })().finally(() => {
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
const AUTH_REFRESH_PATH = '/auth/refresh';

function friendlySignInMessage(message: string): string {
  if (!message || message === 'Unauthorized' || message === 'Invalid credentials') {
    return 'Invalid email or password.';
  }
  return message;
}

function shouldAttemptRefresh(path: string, error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 401) return false;
  if (path === AUTH_REFRESH_PATH || path === '/auth/logout') return false;
  return !AUTH_SIGN_IN_PATHS.has(path);
}

async function handleResponse<T>(res: Response, requestPath?: string): Promise<T> {
  const errBody = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;

  if (res.status === 401) {
    const message = formatErrorMessage(errBody, '');
    const apiPath =
      errBody && typeof errBody.path === 'string'
        ? String(errBody.path)
        : '';
    const isSignInAttempt =
      AUTH_SIGN_IN_PATHS.has(apiPath) ||
      (requestPath != null && AUTH_SIGN_IN_PATHS.has(requestPath));

    // Wrong email/password on sign-in — not a session timeout
    if (isSignInAttempt) {
      throw new ApiError(friendlySignInMessage(message), res.status, errBody);
    }

    if (message && message !== 'Unauthorized') {
      throw new ApiError(message, res.status, errBody);
    }
    throw new ApiError('Session expired. Please sign in again.', res.status, errBody);
  }
  if (res.status === 403) {
    throw new ApiError(formatErrorMessage(errBody, 'Access denied'), res.status, errBody);
  }
  if (!res.ok) {
    throw new ApiError(formatErrorMessage(errBody, res.statusText), res.status, errBody);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function isCsrfError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 403) return false;
  return error.message.toLowerCase().includes('csrf');
}

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const executeRefresh = async () => {
        let res: Response;
        try {
          res = await fetch(`${API_URL}${AUTH_REFRESH_PATH}`, {
            method: 'POST',
            credentials: 'include',
            headers: await buildHeaders({ method: 'POST' }),
          });
        } catch (cause) {
          throw new Error(networkErrorMessage(AUTH_REFRESH_PATH, cause));
        }
        return handleResponse<unknown>(res, AUTH_REFRESH_PATH);
      };

      try {
        await executeRefresh();
      } catch (error) {
        if (isCsrfError(error)) {
          resetCsrfCache();
          await ensureCsrf();
          await executeRefresh();
          return;
        }
        throw error;
      } finally {
        // Refresh rotates auth cookies; future mutations need a CSRF token for the new session.
        resetCsrfCache();
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const executeRequest = async () => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: await buildHeaders(options),
      });
    } catch (cause) {
      throw new Error(networkErrorMessage(path, cause));
    }
    return handleResponse<T>(res, path);
  };

  try {
    return await executeRequest();
  } catch (error) {
    if (shouldAttemptRefresh(path, error)) {
      try {
        await refreshSession();
        return await executeRequest();
      } catch {
        throw error;
      }
    }
    if (isMutation(options?.method) && isCsrfError(error)) {
      resetCsrfCache();
      await ensureCsrf();
      return executeRequest();
    }
    throw error;
  }
}

/** Authenticated API call (session via httpOnly cookies). */
export async function apiAuth<T>(path: string, options?: RequestInit): Promise<T> {
  return api<T>(path, options);
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  resetCsrfCache();
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
  avatarUrl?: string | null;
  providerId?: string | null;
  organizationId?: string;
  organizationSlug?: string;
  organizationName?: string;
  isOwner?: boolean;
  organizations?: { id: string; slug: string; name: string }[];
  reminderPreferences?: ReminderPreferences;
};

export async function fetchMe(): Promise<AuthUser> {
  return apiAuth<AuthUser>('/auth/me', { cache: 'no-store' });
}
