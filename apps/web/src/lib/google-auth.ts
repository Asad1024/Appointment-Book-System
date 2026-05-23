import { getApiUrl } from '@/lib/api';

export type GoogleAuthIntent =
  | 'customer'
  | 'staff'
  | 'business_signup'
  | 'invite_accept';

export type GoogleAuthRole = 'customer' | 'provider' | 'admin' | 'super_admin';

export type GoogleAuthStartOptions = {
  intent: GoogleAuthIntent;
  flow?: 'login' | 'register';
  org?: string;
  inviteToken?: string;
  role?: GoogleAuthRole;
  next?: string | null;
  failurePath?: string;
  companyName?: string;
  adminName?: string;
  timezone?: string;
};

export function buildGoogleAuthStartUrl(options: GoogleAuthStartOptions): string {
  const params = new URLSearchParams();
  params.set('intent', options.intent);
  if (options.flow) params.set('flow', options.flow);
  if (options.org) params.set('org', options.org);
  if (options.inviteToken) params.set('inviteToken', options.inviteToken);
  if (options.role) params.set('role', options.role);
  if (options.next) params.set('next', options.next);
  if (options.failurePath) params.set('failurePath', options.failurePath);
  if (options.companyName) params.set('companyName', options.companyName);
  if (options.adminName) params.set('adminName', options.adminName);
  if (options.timezone) params.set('timezone', options.timezone);
  return `${getApiUrl()}/auth/google/start?${params.toString()}`;
}
